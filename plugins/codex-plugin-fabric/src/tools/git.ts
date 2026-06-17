import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateMutationGuard } from "../guards.js";
import { evaluatePolicy } from "../policy.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema } from "./toolUtils.js";

const GitMutationSchema = {
  confirm: z.boolean().optional(),
  environmentLabel: z.string().optional(),
  expectedWorkspaceId: UuidSchema.optional(),
  allowProduction: z.boolean().optional(),
  preflightPassed: z.boolean().optional()
};

export function registerGitTools(server: McpServer, context: ToolContext): void {
  server.tool("fabric_git_get_connection", "Get Fabric Git connection details for a workspace.", { workspaceId: UuidSchema }, ({ workspaceId }) =>
    safeTool(async () => (await context.client.request(`/workspaces/${workspaceId}/git/connection`)).data)
  );

  server.tool("fabric_git_get_status", "Get Fabric Git status for a workspace.", { workspaceId: UuidSchema }, ({ workspaceId }) =>
    safeTool(async () => {
      const response = await context.client.request(`/workspaces/${workspaceId}/git/status`);
      const resolved = await context.client.resolveOperationIfPresent(response);
      return { operationId: response.operationId, status: resolved.data };
    })
  );

  server.tool("fabric_git_get_my_credentials", "Get the current user's Fabric Git credentials configuration.", {}, () =>
    safeTool(async () => (await context.client.request("/git/myGitCredentials")).data)
  );

  server.tool(
    "fabric_git_readiness",
    "Build a read-only Fabric Git readiness report from workspace Git connection, status, and user credentials.",
    { workspaceId: UuidSchema },
    ({ workspaceId }) =>
      safeTool(async () => {
        const [connection, status, credentials] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/git/connection`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.client.request("/git/myGitCredentials")
        ]);
        const text = JSON.stringify({ connection: connection.data, status: status.data, credentials: credentials.data }).toLowerCase();
        const blockers: string[] = [];
        if (text.includes("not configured") || text.includes("\"none\"")) blockers.push("Git credentials appear not configured.");
        if (text.includes("conflict")) blockers.push("Git status indicates conflicts.");
        if (text.includes("error")) blockers.push("One or more Git readiness calls returned an error.");
        return {
          workspaceId,
          ready: blockers.length === 0,
          blockers,
          connection: connection.data,
          status: status.data,
          credentials: credentials.data
        };
      })
  );

  server.tool(
    "fabric_git_connect",
    "Connect a Fabric workspace to a Git repository and branch with guardrails.",
    {
      workspaceId: UuidSchema,
      gitProvider: z.string().min(1),
      organizationName: z.string().min(1),
      projectName: z.string().optional(),
      repositoryName: z.string().min(1),
      branchName: z.string().min(1),
      directoryName: z.string().optional(),
      ...GitMutationSchema
    },
    (input) =>
      guardedGitMutation(context, "fabric_git_connect", input.workspaceId, input, async () =>
        {
          const response = await context.client.request(`/workspaces/${input.workspaceId}/git/connect`, {
            method: "POST",
            body: {
              gitProviderDetails: {
                gitProviderType: input.gitProvider,
                organizationName: input.organizationName,
                projectName: input.projectName,
                repositoryName: input.repositoryName,
                branchName: input.branchName,
                directoryName: input.directoryName
              }
            }
          });
          return (await context.client.resolveOperationIfPresent(response)).data;
        }
      )
  );

  server.tool(
    "fabric_git_disconnect",
    "Disconnect a Fabric workspace from Git with guardrails.",
    { workspaceId: UuidSchema, ...GitMutationSchema },
    (input) =>
      guardedGitMutation(context, "fabric_git_disconnect", input.workspaceId, input, async () =>
        (await context.client.resolveOperationIfPresent(await context.client.request(`/workspaces/${input.workspaceId}/git/disconnect`, { method: "POST", body: {} }))).data
      )
  );

  server.tool(
    "fabric_git_commit",
    "Commit workspace changes to the connected Git branch with guardrails.",
    {
      workspaceId: UuidSchema,
      comment: z.string().min(1),
      mode: z.enum(["All", "Selective"]).optional().default("All"),
      items: z.array(z.object({ itemIdentifier: z.string().min(1), itemType: z.string().min(1) })).optional(),
      ...GitMutationSchema
    },
    (input) =>
      guardedGitMutation(context, "fabric_git_commit", input.workspaceId, input, async () =>
        {
          const response = await context.client.request(`/workspaces/${input.workspaceId}/git/commitToGit`, {
            method: "POST",
            body: { mode: input.mode, comment: input.comment, items: input.items }
          });
          return (await context.client.resolveOperationIfPresent(response)).data;
        }
      )
  );

  server.tool(
    "fabric_git_update_from_git",
    "Update workspace from connected Git branch with guardrails.",
    {
      workspaceId: UuidSchema,
      remoteCommitHash: z.string().optional(),
      workspaceHead: z.string().optional(),
      conflictResolution: z.record(z.unknown()).optional(),
      ...GitMutationSchema
    },
    (input) =>
      guardedGitMutation(context, "fabric_git_update_from_git", input.workspaceId, input, async () =>
        {
          const response = await context.client.request(`/workspaces/${input.workspaceId}/git/updateFromGit`, {
            method: "POST",
            body: {
              remoteCommitHash: input.remoteCommitHash,
              workspaceHead: input.workspaceHead,
              conflictResolution: input.conflictResolution
            }
          });
          return (await context.client.resolveOperationIfPresent(response)).data;
        }
      )
  );

  server.tool(
    "fabric_git_initialize_connection",
    "Initialize a Fabric Git connection after connect with guardrails.",
    { workspaceId: UuidSchema, ...GitMutationSchema },
    (input) =>
      guardedGitMutation(context, "fabric_git_initialize_connection", input.workspaceId, input, async () => {
        const response = await context.client.request(`/workspaces/${input.workspaceId}/git/initializeConnection`, {
          method: "POST",
          body: {}
        });
        return (await context.client.resolveOperationIfPresent(response)).data;
      })
  );

  server.tool(
    "fabric_git_update_my_credentials",
    "Update the current user's Fabric Git credentials configuration with guardrails.",
    {
      gitCredentialsSource: z.string().min(1),
      connectionId: UuidSchema.optional(),
      confirm: z.boolean().optional(),
      environmentLabel: z.string().optional(),
      expectedWorkspaceId: UuidSchema.optional(),
      allowProduction: z.boolean().optional(),
      preflightPassed: z.boolean().optional()
    },
    (input) =>
      guardedGitMutation(context, "fabric_git_update_my_credentials", input.expectedWorkspaceId ?? "user-git-credentials", input, async () => {
        const response = await context.client.request("/git/myGitCredentials", {
          method: "PATCH",
          body: {
            gitCredentialsSource: input.gitCredentialsSource,
            connectionId: input.connectionId
          }
        });
        return (await context.client.resolveOperationIfPresent(response)).data;
      })
  );
}

async function guardedGitMutation<T>(
  context: ToolContext,
  tool: string,
  workspaceId: string,
  input: Record<string, unknown>,
  action: () => Promise<T>
) {
  return safeTool(async () => {
    const policy = await context.policy.load();
    const guard = validateMutationGuard({ ...input, actualWorkspaceId: workspaceId });
    const policyEvaluation = evaluatePolicy(policy, {
      ...input,
      action: "gitMutation",
      actualWorkspaceId: workspaceId,
      gitProvider: typeof input.gitProvider === "string" ? input.gitProvider : undefined
    });
    const blockers = [...new Set([...guard.blockers, ...policyEvaluation.blockers])];
    if (!guard.allowed || !policyEvaluation.allowed) {
      await context.audit.append({
        timestamp: new Date().toISOString(),
        tool,
        target: { workspaceId },
        status: "blocked",
        input,
        error: blockers
      });
      return { blocked: true, blockers, policyWarnings: policyEvaluation.warnings };
    }
    await context.audit.append({ timestamp: new Date().toISOString(), tool, target: { workspaceId }, status: "started", input });
    const result = await action();
    await context.audit.append({ timestamp: new Date().toISOString(), tool, target: { workspaceId }, status: "succeeded", input });
    return result;
  });
}
