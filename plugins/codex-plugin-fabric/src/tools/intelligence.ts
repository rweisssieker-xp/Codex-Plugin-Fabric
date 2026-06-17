import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  analyzeBlastRadius,
  buildDependencyGraphFromItems,
  decodeDefinitionPayloads,
  enrichGraphFromDefinitions,
  enrichGraphFromKnownReferences,
  extractReferencedIds
} from "../graph.js";
import { compareDefinitions } from "../diff.js";
import { validateMutationGuard } from "../guards.js";
import { evaluatePolicy } from "../policy.js";
import { classifyRisk } from "../risk.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

export function registerIntelligenceTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_bulk_export_item_definitions",
    "Bulk export Fabric item definitions from a workspace using the beta API. Read-only and gated by allowBeta.",
    {
      workspaceId: UuidSchema,
      itemIds: z.array(UuidSchema).optional(),
      allowBeta: z.boolean().optional(),
      timeoutMs: z.number().int().positive().max(900000).optional().default(300000)
    },
    ({ workspaceId, itemIds, allowBeta, timeoutMs }) =>
      safeTool(async () => {
        const policy = await context.policy.load();
        const blockers: string[] = [];
        if (allowBeta !== true) blockers.push("Bulk export beta API requires allowBeta: true.");
        const policyEvaluation = evaluatePolicy(policy, {
          action: "bulkExportDefinitions",
          expectedWorkspaceId: workspaceId,
          actualWorkspaceId: workspaceId,
          isBetaApi: true,
          itemCount: itemIds?.length ?? 0
        });
        blockers.push(...policyEvaluation.blockers);
        if ((itemIds?.length ?? 0) > policy.maxBulkExportItems) {
          blockers.push(`Bulk export item count exceeds policy maxBulkExportItems ${policy.maxBulkExportItems}.`);
        }
        if (blockers.length > 0) return { blocked: true, blockers: [...new Set(blockers)] };
        const response = await context.client.request(`/workspaces/${workspaceId}/items/bulkExport`, {
          method: "POST",
          query: { beta: true },
          body: itemIds ? { items: itemIds.map((itemId) => ({ itemId })) } : {}
        });
        const resolved = await context.client.resolveOperationIfPresent(response, timeoutMs);
        return { operationId: response.operationId, result: resolved.data };
      })
  );

  server.tool(
    "fabric_package_workspace_definitions",
    "Create a read-only package summary for workspace definitions using individual getDefinition calls.",
    {
      workspaceId: UuidSchema,
      itemIds: z.array(UuidSchema).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, itemIds, maxItems }) =>
      safeTool(async () => {
        const itemsResponse = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(itemsResponse.data);
        const selected = itemIds
          ? items.filter((item) => typeof item === "object" && item !== null && itemIds.includes(String((item as Record<string, unknown>).id)))
          : items.slice(0, maxItems);
        const definitions = await fetchDefinitions(context, workspaceId, selected);
        return {
          workspaceId,
          itemCount: selected.length,
          exportedDefinitionCount: definitions.length,
          items: selected,
          definitions
        };
      })
  );

  server.tool(
    "fabric_generate_pull_request_summary",
    "Generate a PR-ready markdown summary from real definition diff, deployment review, blast radius, and risk context.",
    {
      title: z.string().min(1),
      definitionDiff: z.record(z.unknown()).optional(),
      deploymentReview: z.record(z.unknown()).optional(),
      blastRadius: z.record(z.unknown()).optional(),
      risk: z.record(z.unknown()).optional()
    },
    ({ title, definitionDiff, deploymentReview, blastRadius, risk }) =>
      safeTool(async () => {
        if (!definitionDiff && !deploymentReview && !blastRadius && !risk) {
          return {
            blocked: true,
            blockers: ["At least one real review input is required: definitionDiff, deploymentReview, blastRadius, or risk."]
          };
        }
        return {
          markdown: [
          `# ${title}`,
          "## Summary",
          summarizeReview(definitionDiff, deploymentReview, blastRadius, risk),
          "## Definition Changes",
          fenced(definitionDiff ?? {}),
          "## Deployment Review",
          fenced(deploymentReview ?? {}),
          "## Blast Radius",
          fenced(blastRadius ?? {}),
          "## Risk",
          fenced(risk ?? {}),
          "## Checklist",
          "- [ ] Confirm target workspace and item IDs",
          "- [ ] Review policy blockers and warnings",
          "- [ ] Confirm Git status is acceptable",
          "- [ ] Run guarded deployment/apply only after approval"
          ].join("\n\n")
        };
      })
  );

  server.tool(
    "fabric_update_item_definition",
    "Update one Fabric item definition with strict guardrails. Disabled by policy by default.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema,
      expectedWorkspaceId: UuidSchema,
      expectedItemId: UuidSchema,
      itemType: z.string().optional(),
      definition: z.record(z.unknown()),
      confirm: z.boolean().optional(),
      environmentLabel: z.string().optional(),
      allowProduction: z.boolean().optional(),
      preflightPassed: z.boolean().optional(),
      definitionDiffApproved: z.boolean().optional(),
      timeoutMs: z.number().int().positive().max(900000).optional().default(300000)
    },
    (input) =>
      safeTool(async () => {
        const policy = await context.policy.load();
        const guard = validateMutationGuard({
          ...input,
          actualWorkspaceId: input.workspaceId
        });
        const policyEvaluation = evaluatePolicy(policy, {
          ...input,
          action: "updateItemDefinition",
          actualWorkspaceId: input.workspaceId,
          actualItemId: input.itemId,
          isDefinitionApply: true,
          itemTypes: input.itemType ? [input.itemType] : []
        });
        const blockers = [...new Set([...guard.blockers, ...policyEvaluation.blockers])];
        if (policy.allowedApplyItemTypes.length > 0 && input.itemType && !policy.allowedApplyItemTypes.includes(input.itemType)) {
          blockers.push("Item type is not allowed by policy.allowedApplyItemTypes.");
        }
        if (blockers.length > 0) return { blocked: true, blockers };
        await context.audit.append({
          timestamp: new Date().toISOString(),
          tool: "fabric_update_item_definition",
          target: { workspaceId: input.workspaceId, itemId: input.itemId },
          status: "started",
          input
        });
        const response = await context.client.request(`/workspaces/${input.workspaceId}/items/${input.itemId}/updateDefinition`, {
          method: "POST",
          body: input.definition
        });
        const resolved = await context.client.resolveOperationIfPresent(response, input.timeoutMs);
        await context.audit.append({
          timestamp: new Date().toISOString(),
          tool: "fabric_update_item_definition",
          target: { workspaceId: input.workspaceId, itemId: input.itemId },
          status: "succeeded",
          requestId: resolved.requestId ?? response.requestId,
          operationId: response.operationId,
          input
        });
        return { operationId: response.operationId, result: resolved.data };
      })
  );

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
    "fabric_compare_item_definitions",
    "Compare two Fabric item definitions and summarize changed parts and references.",
    {
      left: z.record(z.unknown()),
      right: z.record(z.unknown())
    },
    ({ left, right }) =>
      safeTool(async () => {
        const diff = compareDefinitions(left, right);
        const policy = await context.policy.load();
        const blocked = diff.totalBytes > policy.maxDefinitionDiffBytes;
        return {
          blocked,
          blockers: blocked ? [`Definition diff exceeds policy maxDefinitionDiffBytes ${policy.maxDefinitionDiffBytes}.`] : [],
          diff
        };
      })
  );

  server.tool(
    "fabric_generate_deployment_review",
    "Generate a deployment review from real preflight, definition diff, graph, and policy context.",
    {
      workspaceId: UuidSchema.optional(),
      preflight: z.record(z.unknown()).optional(),
      definitionDiff: z.record(z.unknown()).optional(),
      graph: z.record(z.unknown()).optional(),
      environmentLabel: z.string().optional()
    },
    (input) =>
      safeTool(async () => {
        if (!input.preflight && !input.definitionDiff && !input.graph) {
          return {
            blocked: true,
            blockers: ["Deployment review requires at least one real input: preflight, definitionDiff, or graph."]
          };
        }
        const policy = await context.policy.load();
        const diff = input.definitionDiff as Record<string, unknown> | undefined;
        const graph = input.graph as Record<string, unknown> | undefined;
        const graphEdges = Array.isArray(graph?.edges) ? graph.edges : undefined;
        const observedEdgeCount = graphEdges?.filter((edge) => {
          return typeof edge === "object" && edge !== null && (edge as Record<string, unknown>).confidence === "observed";
        }).length;
        const changedParts = Array.isArray(diff?.changedParts) ? diff.changedParts.length : undefined;
        const addedReferences = Array.isArray(diff?.addedReferences) ? diff.addedReferences.length : undefined;
        return {
          title: "Fabric Deployment Review",
          environmentLabel: input.environmentLabel,
          policy: {
            requireCleanGitBeforeDeployment: policy.requireCleanGitBeforeDeployment,
            maxDefinitionDiffBytes: policy.maxDefinitionDiffBytes
          },
          summary: {
            changedParts,
            addedReferences,
            observedGraphEdges: observedEdgeCount,
            preflightPassed: (input.preflight as Record<string, unknown> | undefined)?.passed
          },
          releaseNotes: [
            changedParts !== undefined ? `${changedParts} definition part(s) changed.` : "No definition diff was provided.",
            addedReferences !== undefined ? `${addedReferences} new reference(s) detected.` : "Reference changes were not provided.",
            observedEdgeCount !== undefined ? `${observedEdgeCount} observed graph relationship(s) included.` : "No graph evidence was provided."
          ],
          recommendation: "Review blockers, confirm target IDs, check Git status, and execute guarded deployment only after approval."
        };
      })
  );

  server.tool(
    "fabric_build_dependency_graph",
    "Build a Fabric dependency graph from workspace items and real item definitions.",
    {
      workspaceId: UuidSchema,
      includeDefinitions: z.boolean().optional().default(true),
      maxDefinitions: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, includeDefinitions, maxDefinitions }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(response.data);
        let graph = buildDependencyGraphFromItems(items, workspaceId);
        if (!includeDefinitions) return { ...graph, evidence: { definitionsRead: 0 } };
        const definitions = await fetchDefinitions(context, workspaceId, items.slice(0, maxDefinitions));
        graph = enrichGraphFromDefinitions(graph, definitions);
        const enriched = enrichGraphFromKnownReferences(graph, referencesFromDefinitions(definitions));
        return { ...enriched, evidence: { definitionsRead: definitions.length } };
      })
  );

  server.tool(
    "fabric_analyze_blast_radius",
    "Analyze likely downstream impact for changed Fabric item IDs.",
    {
      workspaceId: UuidSchema,
      changedItemIds: z.array(UuidSchema).min(1),
      includeDefinitions: z.boolean().optional().default(true),
      maxDefinitions: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, changedItemIds, includeDefinitions, maxDefinitions }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(response.data);
        let graph = buildDependencyGraphFromItems(items, workspaceId);
        let definitionsRead = 0;
        if (includeDefinitions) {
          const definitions = await fetchDefinitions(context, workspaceId, items.slice(0, maxDefinitions));
          definitionsRead = definitions.length;
          graph = enrichGraphFromDefinitions(graph, definitions);
          graph = enrichGraphFromKnownReferences(graph, referencesFromDefinitions(definitions));
        }
        return {
          ...analyzeBlastRadius(graph, changedItemIds),
          evidence: { definitionsRead }
        };
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
        if (Object.keys(runbookContext).length === 0) {
          return { blocked: true, blockers: ["Runbook generation requires real action, preflight, diagnostic, or operation context."] };
        }
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

function fenced(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function summarizeReview(definitionDiff?: Record<string, unknown>, deploymentReview?: Record<string, unknown>, blastRadius?: Record<string, unknown>, risk?: Record<string, unknown>): string {
  const parts = [];
  if (definitionDiff) parts.push("Definition changes are included.");
  if (deploymentReview) parts.push("Deployment review is included.");
  if (blastRadius) parts.push("Blast-radius context is included.");
  if (risk) parts.push("Risk context is included.");
  return parts.length > 0 ? parts.join(" ") : "No structured review inputs were provided.";
}

function referencesFromDefinitions(definitions: Array<{ itemId: string; definition: unknown }>) {
  return definitions.flatMap((entry) =>
    extractReferencedIds(entry.definition).map((sourceId) => ({
      sourceId,
      targetId: entry.itemId,
      relation: "definition-reference",
      reason: "The target item definition references this source ID."
    }))
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
    } catch (error) {
      throw new Error(`Failed to read definition for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return definitions;
}

function readOperationId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.operationId === "string" ? record.operationId : undefined;
}
