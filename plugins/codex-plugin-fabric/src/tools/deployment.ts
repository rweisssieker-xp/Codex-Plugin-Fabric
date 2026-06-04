import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateMutationGuard } from "../guards.js";
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
      allowProduction: z.boolean().optional()
    },
    ({ deploymentPipelineId, stageId, environmentLabel, expectedPipelineId, expectedWorkspaceId, itemIds, allowProduction }) =>
      safeTool(async () => {
        const [stageResponse, itemsResponse] = await Promise.all([
          context.client.request(`/deploymentPipelines/${deploymentPipelineId}/stages/${stageId}`),
          context.client.request(`/deploymentPipelines/${deploymentPipelineId}/stages/${stageId}/items`)
        ]);
        const stage = stageResponse.data as Record<string, unknown>;
        const stageWorkspaceId = typeof stage.workspaceId === "string" ? stage.workspaceId : undefined;
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
        const risk = classifyRisk({
          action: "deploy",
          environmentLabel,
          itemCount: selectedItemCount,
          hasExpectedTarget: Boolean(expectedPipelineId || expectedWorkspaceId),
          hasPreflight: true,
          blockers: guard.blockers
        });
        return {
          passed: guard.allowed && risk.blockers.length === 0,
          deploymentPipelineId,
          stageId,
          stage,
          selectedItemCount,
          risk,
          blockers: [...new Set([...guard.blockers, ...risk.blockers])]
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
        const guard = validateMutationGuard({
          ...input,
          actualPipelineId: input.deploymentPipelineId
        });
        if (!guard.allowed) {
          await context.audit.append({
            timestamp: new Date().toISOString(),
            tool: "fabric_deploy_stage_content",
            target: { deploymentPipelineId: input.deploymentPipelineId, stageId: input.stageId },
            status: "blocked",
            input,
            error: guard.blockers
          });
          return { blocked: true, blockers: guard.blockers };
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

function readOperationId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.operationId === "string" ? record.operationId : undefined;
}
