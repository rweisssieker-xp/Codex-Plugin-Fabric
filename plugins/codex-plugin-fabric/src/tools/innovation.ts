import { createHash } from "node:crypto";
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

const JobTargetSchema = z.object({
  workspaceId: UuidSchema,
  itemId: UuidSchema,
  jobInstanceId: UuidSchema
});

export function registerInnovationTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_control_room_snapshot",
    "Build a real control-room snapshot from workspace, items, Git status, role assignments, connections, graph, policy, and recent audit.",
    {
      workspaceId: UuidSchema,
      maxItems: z.number().int().positive().max(100).optional().default(25),
      includeDefinitions: z.boolean().optional().default(true),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, maxItems, includeDefinitions, auditLimit }) =>
      safeTool(async () => {
        const [workspace, itemsResponse, gitStatus, roleAssignments, policy, environments, audit] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.client.request(`/workspaces/${workspaceId}/roleAssignments`),
          context.policy.load(),
          context.state.listKnownEnvironments(),
          context.audit.read(auditLimit)
        ]);
        const items = valuesArray(itemsResponse.data);
        const selectedItems = items.slice(0, maxItems);
        const itemConnections = await readItemConnections(context, workspaceId, selectedItems);
        const graph = await buildObservedGraph(context, workspaceId, items, includeDefinitions, maxItems);
        const blastRadius = graph.nodes.length > 0 ? analyzeBlastRadius(graph, graph.nodes.slice(0, 1).map((node) => node.id)) : undefined;
        return {
          workspaceId,
          workspace: workspace.data,
          itemCount: items.length,
          typeCounts: countBy(items, "type"),
          gitStatus: gitStatus.data,
          roleAssignments: roleAssignments.data,
          knownEnvironments: environments.filter((environment) => environment.workspaceId === workspaceId),
          itemConnections,
          graph,
          firstItemBlastRadius: blastRadius,
          policy: summarizePolicy(policy),
          recentAudit: audit
        };
      })
  );

  server.tool(
    "fabric_build_lineage_map",
    "Build a real lineage map from Fabric item definitions, item connections, Git status, and optional deployment stage membership.",
    {
      workspaceId: UuidSchema,
      deploymentPipelineId: UuidSchema.optional(),
      stageId: UuidSchema.optional(),
      maxItems: z.number().int().positive().max(100).optional().default(50)
    },
    ({ workspaceId, deploymentPipelineId, stageId, maxItems }) =>
      safeTool(async () => {
        const itemsResponse = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(itemsResponse.data);
        let graph = buildDependencyGraphFromItems(items, workspaceId);
        const definitions = await fetchDefinitions(context, workspaceId, items.slice(0, maxItems));
        graph = enrichGraphFromDefinitions(graph, definitions);
        graph = enrichGraphFromKnownReferences(graph, referencesFromDefinitions(definitions));
        const connectionEdges = await connectionLineage(context, workspaceId, items.slice(0, maxItems));
        const stageItems =
          deploymentPipelineId && stageId
            ? (await context.client.request(`/deploymentPipelines/${deploymentPipelineId}/stages/${stageId}/items`)).data
            : undefined;
        return {
          workspaceId,
          evidence: {
            itemCount: items.length,
            definitionsRead: definitions.length,
            connectionLookups: connectionEdges.length,
            deploymentStageIncluded: Boolean(stageItems)
          },
          graph: {
            nodes: graph.nodes,
            edges: [...graph.edges, ...connectionEdges]
          },
          stageItems
        };
      })
  );

  server.tool(
    "fabric_render_control_room_html",
    "Render a visual HTML control-room report from a real control-room snapshot.",
    {
      snapshot: z.record(z.unknown())
    },
    ({ snapshot }) =>
      safeTool(async () => {
        if (!snapshot.workspaceId || !snapshot.workspace) {
          return { blocked: true, blockers: ["Control-room HTML rendering requires a real fabric_control_room_snapshot result."] };
        }
        return { html: renderControlRoomHtml(snapshot) };
      })
  );

  server.tool(
    "fabric_generate_change_cards",
    "Generate review-ready change cards from real preflight, definition diff, blast radius, connection, permission, and capacity context.",
    {
      definitionDiff: z.record(z.unknown()).optional(),
      preflight: z.record(z.unknown()).optional(),
      blastRadius: z.record(z.unknown()).optional(),
      connectionPolicy: z.record(z.unknown()).optional(),
      permissions: z.record(z.unknown()).optional(),
      capacity: z.record(z.unknown()).optional()
    },
    (input) =>
      safeTool(async () => {
        if (!Object.values(input).some(Boolean)) {
          return { blocked: true, blockers: ["Change cards require real source context."] };
        }
        return { cards: buildChangeCards(input) };
      })
  );

  server.tool(
    "fabric_create_approval_packet",
    "Create a deterministic approval packet from preflight, review, risk, target binding, policy, and expiry context.",
    {
      action: z.string().min(1),
      workspaceId: UuidSchema.optional(),
      deploymentPipelineId: UuidSchema.optional(),
      stageId: UuidSchema.optional(),
      itemIds: z.array(UuidSchema).optional(),
      environmentLabel: z.string().min(1),
      preflight: z.record(z.unknown()),
      review: z.record(z.unknown()),
      expiresAt: z.string().min(1)
    },
    (input) =>
      safeTool(async () => {
        const policy = await context.policy.load();
        const risk = classifyRisk({
          action: input.action,
          environmentLabel: input.environmentLabel,
          itemCount: input.itemIds?.length,
          hasExpectedTarget: Boolean(input.workspaceId || input.deploymentPipelineId),
          hasPreflight: (input.preflight as Record<string, unknown>).passed === true
        });
        const packet = {
          ...input,
          risk,
          policy: summarizePolicy(policy),
          createdAt: new Date().toISOString()
        };
        return {
          approvalId: sha256(packet).slice(0, 32),
          packet,
          requiredMutationInputs: {
            confirm: true,
            environmentLabel: input.environmentLabel,
            expectedWorkspaceId: input.workspaceId,
            expectedPipelineId: input.deploymentPipelineId,
            preflightPassed: true
          }
        };
      })
  );

  server.tool(
    "fabric_analyze_permissions",
    "Analyze real workspace, connection, Git credential, and optional admin access data for a requested Fabric operation.",
    {
      workspaceId: UuidSchema,
      operation: z.enum(["deploy", "runJob", "git", "definitionApply", "admin", "incident"]),
      connectionIds: z.array(UuidSchema).optional(),
      allowAdminPreview: z.boolean().optional()
    },
    ({ workspaceId, operation, connectionIds, allowAdminPreview }) =>
      safeTool(async () => {
        const policy = await context.policy.load();
        const [workspace, roleAssignments, gitCredentials] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/roleAssignments`),
          context.client.request("/git/myGitCredentials")
        ]);
        const connectionRoles = [];
        for (const connectionId of connectionIds ?? []) {
          connectionRoles.push({
            connectionId,
            roleAssignments: (await context.client.request(`/connections/${connectionId}/roleAssignments`)).data
          });
        }
        const adminAccess =
          operation === "admin"
            ? await requireAdminAccess(context, workspaceId, allowAdminPreview)
            : undefined;
        return {
          workspaceId,
          operation,
          workspace: workspace.data,
          roleAssignments: roleAssignments.data,
          gitCredentials: gitCredentials.data,
          connectionRoles,
          adminAccess,
          policy: summarizePolicy(policy),
          requiredChecks: permissionChecklist(operation)
        };
      })
  );

  server.tool(
    "fabric_analyze_capacity_risk",
    "Analyze real workspace and capacity metadata for deployment, refresh, and incident capacity risk.",
    {
      workspaceId: UuidSchema,
      capacityId: UuidSchema.optional()
    },
    ({ workspaceId, capacityId }) =>
      safeTool(async () => {
        const workspace = await context.client.request(`/workspaces/${workspaceId}`);
        const resolvedCapacityId = capacityId ?? stringValue((workspace.data as Record<string, unknown>).capacityId);
        const [capacities, capacity] = await Promise.all([
          context.client.request("/capacities"),
          resolvedCapacityId ? context.client.request(`/capacities/${resolvedCapacityId}`) : Promise.resolve(undefined)
        ]);
        const text = JSON.stringify({ workspace: workspace.data, capacity: capacity?.data }).toLowerCase();
        const signals = [];
        if (text.includes("paused")) signals.push({ severity: "high", message: "Capacity metadata indicates paused state." });
        if (text.includes("failed") || text.includes("unavailable")) signals.push({ severity: "high", message: "Capacity metadata contains failure or unavailable signals." });
        if (text.includes("trial")) signals.push({ severity: "medium", message: "Capacity metadata indicates trial capacity." });
        if (signals.length === 0) signals.push({ severity: "low", message: "No capacity failure signals found in returned metadata." });
        return { workspaceId, capacityId: resolvedCapacityId, workspace: workspace.data, capacity: capacity?.data, capacities: capacities.data, signals };
      })
  );

  server.tool(
    "fabric_correlate_incident",
    "Correlate real Fabric incident signals across workspace metadata, Git status, item connections, job instances, capacity, and recent audit.",
    {
      workspaceId: UuidSchema,
      jobTargets: z.array(JobTargetSchema).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(25),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, jobTargets, maxItems, auditLimit }) =>
      safeTool(async () => {
        const [workspace, itemsResponse, gitStatus, audit, capacities] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.audit.read(auditLimit),
          context.client.request("/capacities")
        ]);
        const items = valuesArray(itemsResponse.data);
        const itemConnections = await readItemConnections(context, workspaceId, items.slice(0, maxItems));
        const jobs = [];
        for (const target of jobTargets ?? []) {
          jobs.push({
            ...target,
            jobInstance: (await context.client.request(`/workspaces/${target.workspaceId}/items/${target.itemId}/jobs/instances/${target.jobInstanceId}`)).data
          });
        }
        const signals = incidentSignals({ workspace: workspace.data, gitStatus: gitStatus.data, itemConnections, jobs, audit, capacities: capacities.data });
        return { workspaceId, workspace: workspace.data, gitStatus: gitStatus.data, itemConnections, jobs, capacities: capacities.data, recentAudit: audit, signals };
      })
  );

  server.tool(
    "fabric_generate_recovery_plan",
    "Generate a recovery plan from real Fabric audit, Git status, optional operation output, and optional definition diff.",
    {
      workspaceId: UuidSchema,
      currentDefinition: z.record(z.unknown()).optional(),
      targetDefinition: z.record(z.unknown()).optional(),
      operation: z.record(z.unknown()).optional(),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, currentDefinition, targetDefinition, operation, auditLimit }) =>
      safeTool(async () => {
        const [workspace, gitStatus, audit] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.audit.read(auditLimit)
        ]);
        const diff = currentDefinition && targetDefinition ? compareDefinitions(currentDefinition, targetDefinition) : undefined;
        return {
          workspaceId,
          workspace: workspace.data,
          gitStatus: gitStatus.data,
          operation,
          diff,
          recentAudit: audit,
          recoveryPlan: recoverySteps(Boolean(diff), Boolean(operation))
        };
      })
  );

  server.tool(
    "fabric_export_as_code_package",
    "Export a real Fabric-as-Code review package with item inventory, definitions, manifest, checksums, graph, and audit context.",
    {
      workspaceId: UuidSchema,
      itemIds: z.array(UuidSchema).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(25),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, itemIds, maxItems, auditLimit }) =>
      safeTool(async () => {
        const [workspace, itemsResponse, gitStatus, audit] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.audit.read(auditLimit)
        ]);
        const items = valuesArray(itemsResponse.data);
        const selected = itemIds
          ? items.filter((item) => item && typeof item === "object" && itemIds.includes(String((item as Record<string, unknown>).id)))
          : items.slice(0, maxItems);
        const definitions = await fetchDefinitions(context, workspaceId, selected);
        let graph = enrichGraphFromDefinitions(buildDependencyGraphFromItems(items, workspaceId), definitions);
        graph = enrichGraphFromKnownReferences(graph, referencesFromDefinitions(definitions));
        const packageBody = {
          workspaceId,
          exportedAt: new Date().toISOString(),
          workspace: workspace.data,
          items: selected,
          definitions,
          gitStatus: gitStatus.data,
          graph,
          recentAudit: audit
        };
        return {
          manifest: {
            workspaceId,
            itemCount: selected.length,
            definitionCount: definitions.length,
            checksum: sha256(packageBody)
          },
          package: packageBody
        };
      })
  );

  server.tool(
    "fabric_validate_live_mutation_readiness",
    "Validate real non-production mutation readiness without executing the mutation.",
    {
      action: z.enum(["deploy", "runItemJob", "gitMutation", "updateItemDefinition"]),
      workspaceId: UuidSchema.optional(),
      deploymentPipelineId: UuidSchema.optional(),
      environmentLabel: z.string().min(1),
      itemCount: z.number().int().nonnegative().optional(),
      confirm: z.boolean().optional(),
      allowProduction: z.boolean().optional(),
      preflightPassed: z.boolean().optional()
    },
    (input) =>
      safeTool(async () => {
        const policy = await context.policy.load();
        const guard = validateMutationGuard({
          confirm: input.confirm,
          environmentLabel: input.environmentLabel,
          expectedWorkspaceId: input.workspaceId,
          actualWorkspaceId: input.workspaceId,
          expectedPipelineId: input.deploymentPipelineId,
          actualPipelineId: input.deploymentPipelineId,
          allowProduction: input.allowProduction,
          preflightPassed: input.preflightPassed
        });
        const policyEvaluation = evaluatePolicy(policy, {
          ...input,
          actualWorkspaceId: input.workspaceId,
          expectedWorkspaceId: input.workspaceId,
          actualPipelineId: input.deploymentPipelineId,
          expectedPipelineId: input.deploymentPipelineId,
          action: input.action,
          itemCount: input.itemCount
        });
        const risk = classifyRisk({
          action: input.action,
          environmentLabel: input.environmentLabel,
          itemCount: input.itemCount,
          hasExpectedTarget: Boolean(input.workspaceId || input.deploymentPipelineId),
          hasPreflight: input.preflightPassed,
          blockers: [...guard.blockers, ...policyEvaluation.blockers]
        });
        return {
          ready: guard.allowed && policyEvaluation.allowed && risk.blockers.length === 0,
          guard,
          policy: { blockers: policyEvaluation.blockers, warnings: policyEvaluation.warnings },
          risk
        };
      })
  );
}

async function buildObservedGraph(context: ToolContext, workspaceId: string, items: unknown[], includeDefinitions: boolean, maxDefinitions: number) {
  let graph = buildDependencyGraphFromItems(items, workspaceId);
  if (!includeDefinitions) return graph;
  const definitions = await fetchDefinitions(context, workspaceId, items.slice(0, maxDefinitions));
  graph = enrichGraphFromDefinitions(graph, definitions);
  return enrichGraphFromKnownReferences(graph, referencesFromDefinitions(definitions));
}

async function fetchDefinitions(context: ToolContext, workspaceId: string, items: unknown[]) {
  const definitions: Array<{ itemId: string; definition: unknown }> = [];
  for (const item of items) {
    const itemId = stringValue((item as Record<string, unknown> | undefined)?.id);
    if (!itemId) continue;
    const response = await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/getDefinition`, { method: "POST" });
    const operationId = stringValue((response.data as Record<string, unknown> | undefined)?.operationId) ?? response.operationId;
    const resolved = operationId ? await context.client.pollOperation(operationId, 300000) : response;
    definitions.push({ itemId, definition: decodeDefinitionPayloads(resolved.data) });
  }
  return definitions;
}

async function readItemConnections(context: ToolContext, workspaceId: string, items: unknown[]) {
  const results = [];
  for (const item of items) {
    const itemId = stringValue((item as Record<string, unknown> | undefined)?.id);
    if (!itemId) continue;
    results.push({ itemId, connections: (await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/connections`)).data });
  }
  return results;
}

async function connectionLineage(context: ToolContext, workspaceId: string, items: unknown[]) {
  const summaries = await readItemConnections(context, workspaceId, items);
  return summaries.flatMap((summary) =>
    extractReferencedIds(summary.connections).map((connectionId) => ({
      from: connectionId,
      to: summary.itemId,
      relation: "connection-reference",
      confidence: "observed" as const,
      reason: "The Fabric item connections API returned this connection ID for the item."
    }))
  );
}

async function requireAdminAccess(context: ToolContext, workspaceId: string, allowAdminPreview?: boolean) {
  const policy = await context.policy.load();
  const policyEvaluation = evaluatePolicy(policy, { action: "adminPreview", isAdminPreview: true, expectedWorkspaceId: workspaceId });
  if (allowAdminPreview !== true || !policyEvaluation.allowed) {
    return { blocked: true, blockers: [...policyEvaluation.blockers, "Admin preview requires allowAdminPreview: true."] };
  }
  return (await context.client.request(`/admin/workspaces/${workspaceId}/users`)).data;
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

function buildChangeCards(input: Record<string, unknown>) {
  const cards = [];
  const diff = input.definitionDiff as Record<string, unknown> | undefined;
  if (diff) cards.push({ title: "Definition Change", severity: diff.blocked ? "high" : "medium", evidence: diff });
  const preflight = input.preflight as Record<string, unknown> | undefined;
  if (preflight) cards.push({ title: "Deployment Preflight", severity: preflight.passed === true ? "low" : "high", evidence: preflight });
  const blastRadius = input.blastRadius as Record<string, unknown> | undefined;
  if (blastRadius) cards.push({ title: "Blast Radius", severity: Array.isArray(blastRadius.affectedNodes) && blastRadius.affectedNodes.length > 5 ? "high" : "medium", evidence: blastRadius });
  if (input.connectionPolicy) cards.push({ title: "Connection Policy", severity: "medium", evidence: input.connectionPolicy });
  if (input.permissions) cards.push({ title: "Permissions", severity: "medium", evidence: input.permissions });
  if (input.capacity) cards.push({ title: "Capacity", severity: "medium", evidence: input.capacity });
  return cards;
}

function incidentSignals(input: Record<string, unknown>) {
  const text = JSON.stringify(input).toLowerCase();
  const signals = [];
  if (text.includes("failed") || text.includes("error")) signals.push({ severity: "high", message: "Returned Fabric evidence contains failure or error signals." });
  if (text.includes("conflict")) signals.push({ severity: "medium", message: "Git or metadata evidence contains conflict signals." });
  if (text.includes("paused") || text.includes("unavailable")) signals.push({ severity: "high", message: "Capacity evidence contains paused or unavailable signals." });
  if (signals.length === 0) signals.push({ severity: "low", message: "No incident keywords found in returned Fabric evidence." });
  return signals;
}

function recoverySteps(hasDiff: boolean, hasOperation: boolean) {
  const steps = [
    "Freeze further guarded mutations for the affected workspace.",
    "Review Git status and recent audit entries to identify the last known good change.",
    "Validate workspace, item, connection, and capacity health before any recovery action."
  ];
  if (hasDiff) steps.push("Use the definition diff to identify exact changed parts and references before applying any rollback.");
  if (hasOperation) steps.push("Use the operation evidence to capture request ID, operation ID, status, and failure category.");
  steps.push("Execute recovery only through existing guarded deployment, Git, job, or definition-apply tools.");
  return steps;
}

function permissionChecklist(operation: string): string[] {
  const base = ["Workspace role assignments returned successfully.", "Current Git credentials endpoint returned successfully."];
  if (operation === "deploy") base.push("Deployment pipeline and stage access must be validated by deployment preflight.");
  if (operation === "git") base.push("Git mutations require policy.allowGitMutations and configured user Git credentials.");
  if (operation === "definitionApply") base.push("Definition apply requires policy.allowDefinitionApply and definitionDiffApproved.");
  if (operation === "admin") base.push("Admin preview requires policy.allowAdminPreview and allowAdminPreview input.");
  return base;
}

function summarizePolicy(policy: unknown) {
  const record = policy as Record<string, unknown>;
  return {
    maxDeploymentItems: record.maxDeploymentItems,
    allowGitMutations: record.allowGitMutations,
    allowAdminPreview: record.allowAdminPreview,
    allowBetaApis: record.allowBetaApis,
    allowDefinitionApply: record.allowDefinitionApply,
    requireCleanGitBeforeDeployment: record.requireCleanGitBeforeDeployment
  };
}

function countBy(items: unknown[], field: string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = stringValue((item as Record<string, unknown> | undefined)?.[field]) ?? "Unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function renderControlRoomHtml(snapshot: Record<string, unknown>): string {
  const title = escapeHtml(`Fabric Control Room - ${String(snapshot.workspaceId)}`);
  const typeCounts = snapshot.typeCounts && typeof snapshot.typeCounts === "object" ? snapshot.typeCounts as Record<string, unknown> : {};
  const graph = snapshot.graph && typeof snapshot.graph === "object" ? snapshot.graph as Record<string, unknown> : {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
  const edges = Array.isArray(graph.edges) ? graph.edges.length : 0;
  const audit = Array.isArray(snapshot.recentAudit) ? snapshot.recentAudit.length : 0;
  const rows = Object.entries(typeCounts)
    .map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td>${escapeHtml(String(count))}</td></tr>`)
    .join("");
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    `<title>${title}</title>`,
    "<style>",
    "body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f7f8fa;color:#1f2937}",
    "main{max-width:1120px;margin:0 auto;padding:24px}",
    "h1{font-size:28px;margin:0 0 18px}",
    ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}",
    ".card{background:white;border:1px solid #d8dee8;border-radius:8px;padding:14px}",
    ".metric{font-size:26px;font-weight:700}",
    "table{width:100%;border-collapse:collapse;background:white;border:1px solid #d8dee8}",
    "td,th{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left}",
    "pre{white-space:pre-wrap;background:#111827;color:#f9fafb;padding:14px;border-radius:8px;overflow:auto}",
    "</style>",
    "</head>",
    "<body><main>",
    `<h1>${title}</h1>`,
    "<section class=\"grid\">",
    `<div class=\"card\"><div>Items</div><div class=\"metric\">${escapeHtml(String(snapshot.itemCount ?? 0))}</div></div>`,
    `<div class=\"card\"><div>Graph Nodes</div><div class=\"metric\">${nodes}</div></div>`,
    `<div class=\"card\"><div>Observed Edges</div><div class=\"metric\">${edges}</div></div>`,
    `<div class=\"card\"><div>Audit Entries</div><div class=\"metric\">${audit}</div></div>`,
    "</section>",
    "<h2>Item Types</h2>",
    `<table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>`,
    "<h2>Snapshot Evidence</h2>",
    `<pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>`,
    "</main></body></html>"
  ].join("");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
