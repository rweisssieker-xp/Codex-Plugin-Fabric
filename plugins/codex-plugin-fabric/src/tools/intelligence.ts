import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  analyzeBlastRadius,
  buildDependencyGraphFromItems,
  decodeDefinitionPayloads,
  enrichGraphFromDefinitions
} from "../graph.js";
import { classifyRisk } from "../risk.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

export function registerIntelligenceTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_get_item_definition",
    "Get a Fabric item definition and optionally decode base64 definition parts.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema,
      format: z.string().optional(),
      decodePayloads: z.boolean().optional().default(true),
      timeoutMs: z.number().int().positive().max(900000).optional().default(300000)
    },
    ({ workspaceId, itemId, format, decodePayloads, timeoutMs }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/getDefinition`, {
          method: "POST",
          query: { format }
        });
        const operationId = response.operationId ?? readOperationId(response.data);
        const resolved = operationId ? await context.client.pollOperation(operationId, timeoutMs) : response;
        return {
          operationId,
          definition: decodePayloads ? decodeDefinitionPayloads(resolved.data) : resolved.data
        };
      })
  );

  server.tool(
    "fabric_build_dependency_graph",
    "Build a Fabric dependency graph from workspace items and optional item definitions.",
    {
      workspaceId: UuidSchema,
      includeDefinitions: z.boolean().optional().default(false),
      maxDefinitions: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, includeDefinitions, maxDefinitions }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(response.data);
        const graph = buildDependencyGraphFromItems(items, workspaceId);
        if (!includeDefinitions) return graph;
        const definitions = await fetchDefinitions(context, workspaceId, items.slice(0, maxDefinitions));
        return enrichGraphFromDefinitions(graph, definitions);
      })
  );

  server.tool(
    "fabric_analyze_blast_radius",
    "Analyze likely downstream impact for changed Fabric item IDs.",
    {
      workspaceId: UuidSchema,
      changedItemIds: z.array(UuidSchema).min(1),
      includeDefinitions: z.boolean().optional().default(false),
      maxDefinitions: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, changedItemIds, includeDefinitions, maxDefinitions }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(response.data);
        let graph = buildDependencyGraphFromItems(items, workspaceId);
        if (includeDefinitions) {
          const definitions = await fetchDefinitions(context, workspaceId, items.slice(0, maxDefinitions));
          graph = enrichGraphFromDefinitions(graph, definitions);
        }
        return analyzeBlastRadius(graph, changedItemIds);
      })
  );

  server.tool(
    "fabric_classify_risk",
    "Classify risk for a Fabric action from environment, target binding, item count, and preflight state.",
    {
      action: z.string().min(1),
      environmentLabel: z.string().optional(),
      itemCount: z.number().int().nonnegative().optional(),
      hasExpectedTarget: z.boolean().optional(),
      hasPreflight: z.boolean().optional(),
      blockers: z.array(z.string()).optional()
    },
    (input) => safeTool(async () => classifyRisk(input))
  );

  server.tool(
    "fabric_generate_runbook",
    "Generate a Markdown runbook from a Fabric action, preflight, diagnosis, or operation result.",
    {
      title: z.string().min(1),
      context: z.record(z.unknown()),
      includeRollbackSection: z.boolean().optional().default(true)
    },
    ({ title, context: runbookContext, includeRollbackSection }) =>
      safeTool(async () => {
        const sections = [
          `# ${title}`,
          "## Context",
          "```json",
          JSON.stringify(runbookContext, null, 2),
          "```",
          "## Steps",
          "1. Confirm the target workspace, deployment pipeline, stage, and item IDs.",
          "2. Run the matching Fabric preflight tool and review blockers.",
          "3. Execute the guarded Fabric action only with explicit confirmation.",
          "4. Poll the operation or job status until it reaches a terminal state.",
          "5. Capture the request ID, operation ID, audit entry, and final result.",
          "## Diagnostics",
          "If the action fails, classify the error and verify auth, permissions, API support, rate limits, and target IDs."
        ];
        if (includeRollbackSection) {
          sections.push(
            "## Rollback",
            "Use the organization's approved Fabric rollback or redeployment process. This plugin does not perform automatic repair or destructive rollback in V1."
          );
        }
        return { markdown: sections.join("\n\n") };
      })
  );
}

async function fetchDefinitions(context: ToolContext, workspaceId: string, items: unknown[]) {
  const definitions: Array<{ itemId: string; definition: unknown }> = [];
  for (const item of items) {
    const itemId = typeof item === "object" && item !== null ? (item as Record<string, unknown>).id : undefined;
    if (typeof itemId !== "string") continue;
    try {
      const response = await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/getDefinition`, {
        method: "POST"
      });
      const operationId = response.operationId ?? readOperationId(response.data);
      const resolved = operationId ? await context.client.pollOperation(operationId, 300000) : response;
      definitions.push({ itemId, definition: decodeDefinitionPayloads(resolved.data) });
    } catch {
      // Not all item types support definitions. Graph construction stays best-effort.
    }
  }
  return definitions;
}

function readOperationId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.operationId === "string" ? record.operationId : undefined;
}
