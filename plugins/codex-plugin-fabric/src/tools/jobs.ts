import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classifyFabricError } from "../diagnostics.js";
import { validateMutationGuard } from "../guards.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema } from "./toolUtils.js";

const GuardSchema = {
  confirm: z.boolean().optional(),
  environmentLabel: z.string().optional(),
  expectedWorkspaceId: UuidSchema.optional(),
  allowProduction: z.boolean().optional(),
  preflightPassed: z.boolean().optional()
};

export function registerJobTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_run_item_job",
    "Run a supported Fabric item job with guardrails.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema,
      jobType: z.string().min(1),
      payload: z.record(z.unknown()).optional(),
      ...GuardSchema
    },
    (input) =>
      safeTool(async () => {
        const guard = validateMutationGuard({
          ...input,
          actualWorkspaceId: input.workspaceId
        });
        if (!guard.allowed) {
          await context.audit.append({
            timestamp: new Date().toISOString(),
            tool: "fabric_run_item_job",
            target: { workspaceId: input.workspaceId, itemId: input.itemId, jobType: input.jobType },
            status: "blocked",
            input,
            error: guard.blockers
          });
          return { blocked: true, blockers: guard.blockers };
        }

        await context.audit.append({
          timestamp: new Date().toISOString(),
          tool: "fabric_run_item_job",
          target: { workspaceId: input.workspaceId, itemId: input.itemId, jobType: input.jobType },
          status: "started",
          input
        });
        const response = await context.client.request(
          `/workspaces/${input.workspaceId}/items/${input.itemId}/jobs/instances`,
          { method: "POST", query: { jobType: input.jobType }, body: input.payload ?? {} }
        );
        await context.audit.append({
          timestamp: new Date().toISOString(),
          tool: "fabric_run_item_job",
          target: { workspaceId: input.workspaceId, itemId: input.itemId, jobType: input.jobType },
          status: "succeeded",
          requestId: response.requestId,
          operationId: response.operationId,
          input
        });
        return { result: response.data, operationId: response.operationId, requestId: response.requestId };
      })
  );

  server.tool(
    "fabric_get_job_instance",
    "Get a Fabric item job instance.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema,
      jobInstanceId: UuidSchema
    },
    ({ workspaceId, itemId, jobInstanceId }) =>
      safeTool(async () =>
        (
          await context.client.request(
            `/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobInstanceId}`
          )
        ).data
      )
  );

  server.tool(
    "fabric_list_recent_job_instances",
    "List recent Fabric item job instances.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema,
      jobType: z.string().optional()
    },
    ({ workspaceId, itemId, jobType }) =>
      safeTool(async () =>
        (
          await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/jobs/instances`, {
            query: { jobType }
          })
        ).data
      )
  );

  server.tool(
    "fabric_diagnose_failed_run",
    "Classify and explain a failed Fabric job instance response.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema,
      jobInstanceId: UuidSchema
    },
    ({ workspaceId, itemId, jobInstanceId }) =>
      safeTool(async () => {
        const response = await context.client.request(
          `/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobInstanceId}`
        );
        const body = response.data as Record<string, unknown>;
        const failure = body.failureReason ?? body.error ?? body;
        return {
          jobInstance: body,
          diagnosis: classifyFabricError({
            body: failure,
            message: typeof body.status === "string" ? `Job status: ${body.status}` : "Job diagnosis.",
            requestId: response.requestId
          })
        };
      })
  );
}
