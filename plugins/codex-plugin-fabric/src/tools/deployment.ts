import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateMutationGuard } from "../guards.js";
import { evaluatePolicy } from "../policy.js";
import { classifyRisk } from "../risk.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

const GuardSchema = {
  confirm: z.boolean().optional(),
  environmentLabel: z.string().optional(),
  expectedPipelineId: UuidSchema.optional(),
  expectedWorkspaceId: UuidSchema.optional(),
  allowProduction: z.boolean().optional(),
  preflightPassed: z.boolean().optional()
};

export function registerDeploymentTools(server: McpServer, context: ToolContext): void {
  server.tool("fabric_list_deployment_pipelines", "List Fabric deployment pipelines.", {}, () =>
    safeTool(async () => (await context.client.request("/deploymentPipelines")).data)
  );

  server.tool(
    "fabric_get_deployment_pipeline",
    "Get one Fabric deployment pipeline.",
    { deploymentPipelineId: UuidSchema },
    ({ deploymentPipelineId }) =>
      safeTool(async () => (await context.client.request(`/deploymentPipelines/${deploymentPipelineId}`)).data)
  );

  server.tool(
    "fabric_list_deployment_pipeline_operations",
    "List operations for a Fabric deployment pipeline.",
    { deploymentPipelineId: UuidSchema },
    ({ deploymentPipelineId }) =>
      safeTool(async () => (await context.client.request(`/deploymentPipelines/${deploymentPipelineId}/operations`)).data)
  );

  server.tool(
    "fabric_get_deployment_pipeline_operation",
    "Get one deployment pipeline operation with execution plan details.",
    { deploymentPipelineId: UuidSchema, operationId: z.string().min(1) },
    ({ deploymentPipelineId, operationId }) =>
      safeTool(async () => (await context.client.request(`/deploymentPipelines/${deploymentPipelineId}/operations/${operationId}`)).data)
  );

  server.tool(
    "fabric_list_deployment_stages",
    "List stages for a Fabric deployment pipeline.",
    { deploymentPipelineId: UuidSchema },
    ({ deploymentPipelineId }) =>
      safeTool(async () => (await context.client.request(`/deploymentPipelines/${deploymentPipelineId}/stages`)).data)
  );

  server.tool(
    "fabric_list_stage_items",
    "List items assigned to a Fabric deployment pipeline stage.",
    { deploymentPipelineId: UuidSchema, stageId: UuidSchema },
    ({ deploymentPipelineId, stageId }) =>
      safeTool(async () =>
        (
          await context.client.request(
            `/deploymentPipelines/${deploymentPipelineId}/stages/${stageId}/items`
          )
        ).data
      )
  );

  server.tool(
    "fabric_deployment_preflight",
    "Validate target binding, stage items, and risk before deploying Fabric stage content.",
    {
      deploymentPipelineId: UuidSchema,
      stageId: UuidSchema,
      environmentLabel: z.string(),
      expectedPipelineId: UuidSchema.optional(),
      expectedWorkspaceId: UuidSchema.optional(),
      itemIds: z.array(UuidSchema).optional(),
      allowProduction: z.boolean().optional(),
      includeGitStatus: z.boolean().optional().default(false)
    },
    ({ deploymentPipelineId, stageId, environmentLabel, expectedPipelineId, expectedWorkspaceId, itemIds, allowProduction, includeGitStatus }) =>
      safeTool(async () => {
        const [stageResponse, itemsResponse] = await Promise.all([
          context.client.request(`/deploymentPipelines/${deploymentPipelineId}/stages/${stageId}`),
          context.client.request(`/deploymentPipelines/${deploymentPipelineId}/stages/${stageId}/items`)
        ]);
        const stage = stageResponse.data as Record<string, unknown>;
        const stageWorkspaceId = typeof stage.workspaceId === "string" ? stage.workspaceId : undefined;
        const gitStatusResponse =
          includeGitStatus && stageWorkspaceId
            ? await context.client.request(`/workspaces/${stageWorkspaceId}/git/status`)
            : undefined;
        const gitStatusClean = inferCleanGitStatus(gitStatusResponse?.data);
        const guard = validateMutationGuard({
          confirm: true,
          environmentLabel,
          expectedPipelineId,
          actualPipelineId: deploymentPipelineId,
          expectedWorkspaceId,
          actualWorkspaceId: stageWorkspaceId,
          allowProduction,
          preflightPassed: true
        });
        const items = valuesArray(itemsResponse.data);
        const selectedItemCount = itemIds?.length ?? items.length;
        const selectedTypes = extractItemTypes(items, itemIds);
        const policy = await context.policy.load();
        const policyEvaluation = evaluatePolicy(policy, {
          action: "deploy",
          environmentLabel,
          expectedPipelineId,
          actualPipelineId: deploymentPipelineId,
          expectedWorkspaceId,
          actualWorkspaceId: stageWorkspaceId,
          allowProduction,
          preflightPassed: true,
          itemCount: selectedItemCount,
          itemTypes: selectedTypes,
          gitStatusClean
        });
        const risk = classifyRisk({
          action: "deploy",
          environmentLabel,
          itemCount: selectedItemCount,
          hasExpectedTarget: Boolean(expectedPipelineId || expectedWorkspaceId),
          hasPreflight: true,
          blockers: [...guard.blockers, ...policyEvaluation.blockers]
        });
        return {
          passed: guard.allowed && policyEvaluation.allowed && risk.blockers.length === 0,
          deploymentPipelineId,
          stageId,
          stage,
          selectedItemCount,
          selectedTypes,
          policy: {
            warnings: policyEvaluation.warnings,
            blockers: policyEvaluation.blockers,
            maxDeploymentItems: policy.maxDeploymentItems
          },
          gitStatus: gitStatusResponse?.data,
          risk,
          blockers: [...new Set([...guard.blockers, ...policyEvaluation.blockers, ...risk.blockers])]
        };
      })
  );

  server.tool(
    "fabric_deploy_stage_content",
    "Deploy Fabric deployment pipeline stage content with guardrails and LRO polling.",
    {
      deploymentPipelineId: UuidSchema,
      stageId: UuidSchema,
      itemIds: z.array(UuidSchema).optional(),
      timeoutMs: z.number().int().positive().max(900000).optional().default(300000),
      ...GuardSchema
    },
    (input) =>
      safeTool(async () => {
        const policy = await context.policy.load();
        const guard = validateMutationGuard({
          ...input,
          actualPipelineId: input.deploymentPipelineId
        });
        const policyEvaluation = evaluatePolicy(policy, {
          ...input,
          action: "deploy",
          actualPipelineId: input.deploymentPipelineId,
          itemCount: input.itemIds?.length ?? 0
        });
        const blockers = [...new Set([...guard.blockers, ...policyEvaluation.blockers])];
        if (!guard.allowed || !policyEvaluation.allowed) {
          await context.audit.append({
            timestamp: new Date().toISOString(),
            tool: "fabric_deploy_stage_content",
            target: { deploymentPipelineId: input.deploymentPipelineId, stageId: input.stageId },
            status: "blocked",
            input,
            error: blockers
          });
          return { blocked: true, blockers, policyWarnings: policyEvaluation.warnings };
        }

        const body = input.itemIds ? { items: input.itemIds.map((itemId) => ({ itemId })) } : {};
        await context.audit.append({
          timestamp: new Date().toISOString(),
          tool: "fabric_deploy_stage_content",
          target: { deploymentPipelineId: input.deploymentPipelineId, stageId: input.stageId },
          status: "started",
          input
        });
        const start = await context.client.request(
          `/deploymentPipelines/${input.deploymentPipelineId}/stages/${input.stageId}/deploy`,
          { method: "POST", body }
        );
        const operationId = start.operationId ?? readOperationId(start.data);
        const result = operationId ? await context.client.pollOperation(operationId, input.timeoutMs) : start;
        await context.audit.append({
          timestamp: new Date().toISOString(),
          tool: "fabric_deploy_stage_content",
          target: { deploymentPipelineId: input.deploymentPipelineId, stageId: input.stageId },
          status: "succeeded",
          requestId: result.requestId ?? start.requestId,
          operationId,
          input
        });
        return { started: start.data, operationId, result: result.data };
      })
  );

  server.tool(
    "fabric_get_operation_state",
    "Get a Fabric long-running operation state.",
    { operationId: z.string().min(1) },
    ({ operationId }) => safeTool(async () => (await context.client.request(`/operations/${operationId}`)).data)
  );

  server.tool(
    "fabric_get_operation_result",
    "Get a Fabric long-running operation result.",
    { operationId: z.string().min(1) },
    ({ operationId }) => safeTool(async () => (await context.client.request(`/operations/${operationId}/result`)).data)
  );
}

function inferCleanGitStatus(data: unknown): boolean | undefined {
  if (!data || typeof data !== "object") return undefined;
  const text = JSON.stringify(data).toLowerCase();
  if (text.includes("conflict") || text.includes("uncommitted") || text.includes("behind") || text.includes("ahead")) return false;
  if (text.includes("up to date") || text.includes("uptodate") || text.includes("clean")) return true;
  return undefined;
}

function extractItemTypes(items: unknown[], selectedItemIds?: string[]): string[] {
  const selected = selectedItemIds ? new Set(selectedItemIds) : undefined;
  return items
    .filter((item) => {
      if (!selected) return true;
      const id = typeof item === "object" && item !== null ? (item as Record<string, unknown>).id : undefined;
      return typeof id === "string" && selected.has(id);
    })
    .map((item) => {
      const record = item as Record<string, unknown>;
      return typeof record.itemType === "string"
        ? record.itemType
        : typeof record.type === "string"
          ? record.type
          : "Unknown";
    });
}

function readOperationId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.operationId === "string" ? record.operationId : undefined;
}
