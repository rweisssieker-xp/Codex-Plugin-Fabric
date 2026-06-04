import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeBlastRadius, buildDependencyGraphFromItems } from "../graph.js";
import { classifyRisk } from "../risk.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

export function registerIntelligenceTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_build_dependency_graph",
    "Build a heuristic Fabric dependency graph from workspace items.",
    { workspaceId: UuidSchema },
    ({ workspaceId }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items`);
        return buildDependencyGraphFromItems(valuesArray(response.data), workspaceId);
      })
  );

  server.tool(
    "fabric_analyze_blast_radius",
    "Analyze likely downstream impact for changed Fabric item IDs.",
    { workspaceId: UuidSchema, changedItemIds: z.array(UuidSchema).min(1) },
    ({ workspaceId, changedItemIds }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items`);
        const graph = buildDependencyGraphFromItems(valuesArray(response.data), workspaceId);
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
