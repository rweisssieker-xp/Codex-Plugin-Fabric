import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { compareDefinitions } from "../diff.js";
import { decodeDefinitionPayloads } from "../graph.js";
import { DEFAULT_POLICY, FabricPolicy, evaluatePolicy } from "../policy.js";
import { classifyRisk } from "../risk.js";
import {
  buildWorkspaceFingerprint,
  calculateAssuranceScore,
  compareWorkspaceFingerprints,
  diffPolicies,
  rankRootCauses,
  sha256,
  sortTimeline,
  TimelineEvent
} from "../usp.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

const FingerprintSchema = z.object({
  workspaceId: z.string(),
  items: z.array(z.object({
    id: z.string().optional(),
    displayName: z.string().optional(),
    type: z.string().optional(),
    checksum: z.string()
  })),
  definitions: z.array(z.object({ itemId: z.string(), checksum: z.string() })),
  connectionsChecksum: z.string(),
  gitChecksum: z.string(),
  roleChecksum: z.string(),
  capacityChecksum: z.string(),
  checksum: z.string()
});

const TimelineEventSchema = z.object({
  timestamp: z.string(),
  source: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  message: z.string(),
  evidence: z.unknown().optional()
});

export function registerEnterpriseTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_change_assurance_score",
    "Calculate a change assurance score from real preflight, diff, risk, Git, capacity, and approval context.",
    {
      preflight: z.record(z.unknown()).optional(),
      definitionDiff: z.record(z.unknown()).optional(),
      risk: z.record(z.unknown()).optional(),
      gitStatus: z.record(z.unknown()).optional(),
      capacity: z.record(z.unknown()).optional(),
      approvalPacket: z.record(z.unknown()).optional()
    },
    (input) =>
      safeTool(async () => calculateAssuranceScore(scoreInput(input)))
  );

  server.tool(
    "fabric_change_assurance_report",
    "Build a read-only change assurance report from real Fabric workspace, policy, Git, lineage, capacity, permissions, and audit evidence.",
    {
      workspaceId: UuidSchema,
      preflight: z.record(z.unknown()).optional(),
      definitionDiff: z.record(z.unknown()).optional(),
      approvalPacket: z.record(z.unknown()).optional(),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, preflight, definitionDiff, approvalPacket, auditLimit }) =>
      safeTool(async () => {
        const [workspace, itemsResponse, gitStatus, roleAssignments, capacities, policy, audit] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.client.request(`/workspaces/${workspaceId}/roleAssignments`),
          context.client.request("/capacities"),
          context.policy.load(),
          context.audit.read(auditLimit)
        ]);
        const items = valuesArray(itemsResponse.data);
        const risk = classifyRisk({
          action: "changeAssurance",
          itemCount: items.length,
          hasExpectedTarget: true,
          hasPreflight: preflight ? (preflight as Record<string, unknown>).passed === true : false
        });
        const score = calculateAssuranceScore(scoreInput({ preflight, definitionDiff, risk, gitStatus: gitStatus.data as Record<string, unknown>, capacity: capacities.data as Record<string, unknown>, approvalPacket }));
        return {
          workspaceId,
          workspace: workspace.data,
          itemCount: items.length,
          gitStatus: gitStatus.data,
          roleAssignments: roleAssignments.data,
          capacities: capacities.data,
          policy: summarizePolicy(policy),
          preflight,
          definitionDiff,
          approvalPacket,
          risk,
          score,
          recentAudit: audit
        };
      })
  );

  server.tool(
    "fabric_change_assurance_html",
    "Render a compact HTML report for change boards from a real change assurance report.",
    { report: z.record(z.unknown()) },
    ({ report }) =>
      safeTool(async () => {
        if (!report.workspaceId || !report.score) return { blocked: true, blockers: ["HTML rendering requires a fabric_change_assurance_report result."] };
        return { html: renderAssuranceHtml(report) };
      })
  );

  server.tool(
    "fabric_simulate_policy_on_workspace",
    "Simulate active policy against real workspace, items, connections, Git, and capacity context without writing policy files.",
    {
      workspaceId: UuidSchema,
      environmentLabel: z.string().optional().default("test"),
      itemIds: z.array(UuidSchema).optional()
    },
    ({ workspaceId, environmentLabel, itemIds }) =>
      safeTool(async () => {
        const [workspace, itemsResponse, gitStatus, capacities, policy] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.client.request("/capacities"),
          context.policy.load()
        ]);
        const items = valuesArray(itemsResponse.data);
        const itemTypes = items.map((item) => stringValue((item as Record<string, unknown>).type) ?? "Unknown");
        const deploy = evaluatePolicy(policy, {
          action: "deploy",
          environmentLabel,
          expectedWorkspaceId: workspaceId,
          actualWorkspaceId: workspaceId,
          itemCount: itemIds?.length ?? items.length,
          itemTypes,
          preflightPassed: true,
          gitStatusClean: !JSON.stringify(gitStatus.data).toLowerCase().includes("conflict")
        });
        return { workspaceId, workspace: workspace.data, gitStatus: gitStatus.data, capacities: capacities.data, policy: summarizePolicy(policy), deploy };
      })
  );

  server.tool(
    "fabric_suggest_policy_tightening",
    "Suggest concrete policy tightening from real workspace, connection, gateway, and Git evidence without editing policy files.",
    {
      workspaceId: UuidSchema,
      connectionIds: z.array(UuidSchema).optional(),
      gatewayIds: z.array(UuidSchema).optional()
    },
    ({ workspaceId, connectionIds, gatewayIds }) =>
      safeTool(async () => {
        const [workspace, gitStatus, policy] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.policy.load()
        ]);
        const suggestions: Record<string, unknown> = {};
        if (policy.allowedWorkspaceIds.length === 0) suggestions.allowedWorkspaceIds = [workspaceId];
        if (connectionIds && connectionIds.length > 0 && policy.allowedConnectionIds.length === 0) suggestions.allowedConnectionIds = connectionIds;
        if (gatewayIds && gatewayIds.length > 0 && policy.allowedGatewayIds.length === 0) suggestions.allowedGatewayIds = gatewayIds;
        if (!policy.requireCleanGitBeforeDeployment && JSON.stringify(gitStatus.data).toLowerCase().includes("clean")) suggestions.requireCleanGitBeforeDeployment = true;
        return { workspaceId, workspace: workspace.data, gitStatus: gitStatus.data, suggestions };
      })
  );

  server.tool(
    "fabric_policy_diff",
    "Compare two Fabric policy versions and show changed, newly allowed, and newly blocked controls.",
    {
      left: z.record(z.unknown()),
      right: z.record(z.unknown())
    },
    ({ left, right }) => safeTool(async () => diffPolicies(normalizePolicy(left), normalizePolicy(right)))
  );

  server.tool(
    "fabric_fingerprint_workspace",
    "Create a workspace fingerprint from real items, definition hashes, connections, Git status, role assignments, and capacity metadata.",
    {
      workspaceId: UuidSchema,
      maxItems: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, maxItems }) =>
      safeTool(async () => {
        const [itemsResponse, gitStatus, roleAssignments, capacities] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.client.request(`/workspaces/${workspaceId}/roleAssignments`),
          context.client.request("/capacities")
        ]);
        const items = valuesArray(itemsResponse.data);
        const selected = items.slice(0, maxItems);
        const definitions = await fetchDefinitions(context, workspaceId, selected);
        const connections = await readConnections(context, workspaceId, selected);
        return buildWorkspaceFingerprint({
          workspaceId,
          items,
          definitions,
          connections,
          gitStatus: gitStatus.data,
          roleAssignments: roleAssignments.data,
          capacity: capacities.data
        });
      })
  );

  server.tool(
    "fabric_compare_environment_fingerprints",
    "Compare two workspace fingerprints and show environment drift.",
    { left: FingerprintSchema, right: FingerprintSchema },
    ({ left, right }) => safeTool(async () => compareWorkspaceFingerprints(left as ReturnType<typeof buildWorkspaceFingerprint>, right as ReturnType<typeof buildWorkspaceFingerprint>))
  );

  server.tool(
    "fabric_drift_review_cards",
    "Generate review cards for missing items, changed definitions, connection drift, role drift, Git drift, and capacity drift.",
    { drift: z.record(z.unknown()) },
    ({ drift }) => safeTool(async () => ({ cards: driftCards(drift) }))
  );

  server.tool(
    "fabric_build_incident_timeline",
    "Build an incident timeline from real audit events, deployment operations, job instances, Git status, and capacity signals.",
    {
      workspaceId: UuidSchema,
      deploymentPipelineId: UuidSchema.optional(),
      jobTargets: z.array(z.object({ workspaceId: UuidSchema, itemId: UuidSchema, jobInstanceId: UuidSchema })).optional(),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, deploymentPipelineId, jobTargets, auditLimit }) =>
      safeTool(async () => {
        const [workspace, gitStatus, capacities, audit] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.client.request("/capacities"),
          context.audit.read(auditLimit)
        ]);
        const operations = deploymentPipelineId ? valuesArray((await context.client.request(`/deploymentPipelines/${deploymentPipelineId}/operations`)).data) : [];
        const jobs = [];
        for (const target of jobTargets ?? []) {
          jobs.push((await context.client.request(`/workspaces/${target.workspaceId}/items/${target.itemId}/jobs/instances/${target.jobInstanceId}`)).data);
        }
        return {
          workspaceId,
          timeline: sortTimeline([
            ...auditToEvents(audit),
            ...operationEvents(operations),
            ...jobEvents(jobs),
            ...metadataEvents("workspace", workspace.data),
            ...metadataEvents("git", gitStatus.data),
            ...metadataEvents("capacity", capacities.data)
          ])
        };
      })
  );

  server.tool(
    "fabric_rank_root_causes",
    "Rank root-cause candidates from real incident timeline events.",
    { timeline: z.array(TimelineEventSchema) },
    ({ timeline }) => safeTool(async () => ({ rootCauses: rankRootCauses(timeline as TimelineEvent[]) }))
  );

  server.tool(
    "fabric_incident_brief",
    "Create an executive and operator incident brief from timeline and ranked root causes.",
    {
      workspaceId: UuidSchema,
      timeline: z.array(TimelineEventSchema),
      rootCauses: z.array(z.record(z.unknown()))
    },
    ({ workspaceId, timeline, rootCauses }) =>
      safeTool(async () => ({
        workspaceId,
        executiveSummary: `${timeline.length} evidence event(s) reviewed. Top candidate: ${String(rootCauses[0]?.cause ?? "Unknown")}.`,
        topRootCauses: rootCauses.slice(0, 3),
        operatorDetails: { timeline }
      }))
  );

  server.tool(
    "fabric_generate_deploy_playbook",
    "Generate a guided deploy playbook from preflight, approval packet, and explicit target binding.",
    {
      workspaceId: UuidSchema,
      deploymentPipelineId: UuidSchema,
      stageId: UuidSchema,
      environmentLabel: z.string().min(1),
      preflight: z.record(z.unknown()),
      approvalPacket: z.record(z.unknown())
    },
    (input) => safeTool(async () => ({ playbook: deployPlaybook(input) }))
  );

  server.tool(
    "fabric_validate_playbook_step",
    "Validate whether one guided playbook step is satisfied by supplied real evidence.",
    {
      stepId: z.string().min(1),
      evidence: z.record(z.unknown())
    },
    ({ stepId, evidence }) =>
      safeTool(async () => ({
        stepId,
        passed: validateStep(stepId, evidence),
        evidenceChecksum: sha256(evidence)
      }))
  );

  server.tool(
    "fabric_finalize_mutation_evidence",
    "Create final mutation evidence from request IDs, operation IDs, audit, and mutation result.",
    {
      workspaceId: UuidSchema.optional(),
      deploymentPipelineId: UuidSchema.optional(),
      requestId: z.string().optional(),
      operationId: z.string().optional(),
      result: z.record(z.unknown()),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, deploymentPipelineId, requestId, operationId, result, auditLimit }) =>
      safeTool(async () => {
        const audit = await context.audit.read(auditLimit);
        const evidence = { workspaceId, deploymentPipelineId, requestId, operationId, result, audit, finalizedAt: new Date().toISOString() };
        return { evidence, checksum: sha256(evidence) };
      })
  );
}

async function fetchDefinitions(context: ToolContext, workspaceId: string, items: unknown[]) {
  const definitions: Array<{ itemId: string; definition: unknown }> = [];
  for (const item of items) {
    const itemId = stringValue((item as Record<string, unknown> | undefined)?.id);
    if (!itemId) continue;
    const response = await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/getDefinition`, { method: "POST" });
    const resolved = response.operationId ? await context.client.pollOperation(response.operationId, 300000) : response;
    definitions.push({ itemId, definition: decodeDefinitionPayloads(resolved.data) });
  }
  return definitions;
}

async function readConnections(context: ToolContext, workspaceId: string, items: unknown[]) {
  const values = [];
  for (const item of items) {
    const itemId = stringValue((item as Record<string, unknown> | undefined)?.id);
    if (!itemId) continue;
    values.push({ itemId, connections: (await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/connections`)).data });
  }
  return values;
}

function scoreInput(input: Record<string, unknown>) {
  const preflight = input.preflight as Record<string, unknown> | undefined;
  const diff = input.definitionDiff as Record<string, unknown> | undefined;
  const risk = input.risk as Record<string, unknown> | undefined;
  const gitText = JSON.stringify(input.gitStatus ?? {}).toLowerCase();
  const capacity = input.capacity as Record<string, unknown> | undefined;
  return {
    blockers: [...stringArray(preflight?.blockers), ...stringArray(risk?.blockers)],
    warnings: stringArray((preflight?.policy as Record<string, unknown> | undefined)?.warnings),
    riskLevel: risk?.level as "low" | "medium" | "high" | undefined,
    changedParts: Array.isArray((diff?.diff as Record<string, unknown> | undefined)?.changedParts) ? ((diff?.diff as Record<string, unknown>).changedParts as unknown[]).length : undefined,
    affectedNodes: Array.isArray((input.blastRadius as Record<string, unknown> | undefined)?.affectedNodes) ? ((input.blastRadius as Record<string, unknown>).affectedNodes as unknown[]).length : undefined,
    hasCleanGit: gitText.length > 2 ? !(gitText.includes("conflict") || gitText.includes("behind") || gitText.includes("uncommitted")) : undefined,
    hasApproval: Boolean(input.approvalPacket),
    capacitySignals: Array.isArray(capacity?.signals) ? capacity.signals as Array<{ severity?: string }> : []
  };
}

function normalizePolicy(value: Record<string, unknown>): FabricPolicy {
  return { ...DEFAULT_POLICY, ...value } as FabricPolicy;
}

function summarizePolicy(policy: FabricPolicy) {
  return {
    maxDeploymentItems: policy.maxDeploymentItems,
    allowGitMutations: policy.allowGitMutations,
    allowAdminPreview: policy.allowAdminPreview,
    allowBetaApis: policy.allowBetaApis,
    allowDefinitionApply: policy.allowDefinitionApply,
    requireCleanGitBeforeDeployment: policy.requireCleanGitBeforeDeployment
  };
}

function driftCards(drift: Record<string, unknown>) {
  const cards = [];
  for (const key of ["missingInRight", "missingInLeft", "changedItems"]) {
    const values = drift[key];
    if (Array.isArray(values) && values.length > 0) cards.push({ title: key, severity: "high", evidence: values });
  }
  for (const key of ["connectionDrift", "gitDrift", "roleDrift", "capacityDrift"]) {
    if (drift[key] === true) cards.push({ title: key, severity: "medium", evidence: true });
  }
  const definitionDrift = drift.definitionDrift as Record<string, unknown> | undefined;
  if (definitionDrift && JSON.stringify(definitionDrift) !== JSON.stringify({ missingInRight: [], missingInLeft: [], changed: [] })) {
    cards.push({ title: "definitionDrift", severity: "high", evidence: definitionDrift });
  }
  return cards;
}

function auditToEvents(audit: unknown[]): TimelineEvent[] {
  return audit.map((entry) => {
    const record = entry as Record<string, unknown>;
    return {
      timestamp: stringValue(record.timestamp) ?? new Date(0).toISOString(),
      source: `audit:${stringValue(record.tool) ?? "unknown"}`,
      severity: record.status === "failed" || record.status === "blocked" ? "high" : "low",
      message: `Audit status ${String(record.status ?? "unknown")}`,
      evidence: record
    };
  });
}

function operationEvents(operations: unknown[]): TimelineEvent[] {
  return operations.map((operation) => {
    const record = operation as Record<string, unknown>;
    return {
      timestamp: stringValue(record.createdTime) ?? stringValue(record.startTime) ?? new Date(0).toISOString(),
      source: "deploymentOperation",
      severity: JSON.stringify(record).toLowerCase().includes("fail") ? "high" : "medium",
      message: `Deployment operation ${String(record.status ?? record.id ?? "returned")}`,
      evidence: record
    };
  });
}

function jobEvents(jobs: unknown[]): TimelineEvent[] {
  return jobs.map((job) => {
    const record = job as Record<string, unknown>;
    return {
      timestamp: stringValue(record.startTime) ?? stringValue(record.createdTime) ?? new Date(0).toISOString(),
      source: "job",
      severity: JSON.stringify(record).toLowerCase().includes("fail") ? "high" : "medium",
      message: `Job ${String(record.status ?? record.id ?? "returned")}`,
      evidence: record
    };
  });
}

function metadataEvents(source: string, data: unknown): TimelineEvent[] {
  const text = JSON.stringify(data).toLowerCase();
  const severity = text.includes("fail") || text.includes("conflict") || text.includes("paused") ? "high" : "low";
  return [{ timestamp: new Date().toISOString(), source, severity, message: `${source} metadata returned`, evidence: data }];
}

function deployPlaybook(input: Record<string, unknown>) {
  return {
    id: sha256(input).slice(0, 16),
    target: {
      workspaceId: input.workspaceId,
      deploymentPipelineId: input.deploymentPipelineId,
      stageId: input.stageId,
      environmentLabel: input.environmentLabel
    },
    steps: [
      { id: "preflight", label: "Verify preflight passed", requiredEvidence: "preflight.passed === true" },
      { id: "approval", label: "Verify approval packet exists", requiredEvidence: "approvalPacket.approvalId" },
      { id: "target-binding", label: "Verify expected workspace or pipeline ID is bound", requiredEvidence: "expectedWorkspaceId or expectedPipelineId" },
      { id: "execute", label: "Execute guarded deploy tool with confirm true", requiredEvidence: "requestId or operationId" },
      { id: "finalize", label: "Finalize mutation evidence", requiredEvidence: "mutation result and audit entries" }
    ]
  };
}

function validateStep(stepId: string, evidence: Record<string, unknown>): boolean {
  if (stepId === "preflight") return evidence.passed === true || (evidence.preflight as Record<string, unknown> | undefined)?.passed === true;
  if (stepId === "approval") return Boolean(evidence.approvalId || (evidence.approvalPacket as Record<string, unknown> | undefined)?.approvalId);
  if (stepId === "target-binding") return Boolean(evidence.expectedWorkspaceId || evidence.expectedPipelineId || evidence.workspaceId || evidence.deploymentPipelineId);
  if (stepId === "execute") return Boolean(evidence.requestId || evidence.operationId);
  if (stepId === "finalize") return Boolean(evidence.result && evidence.audit);
  return false;
}

function renderAssuranceHtml(report: Record<string, unknown>) {
  const score = report.score as Record<string, unknown>;
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"><title>Fabric Change Assurance</title>",
    "<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1f2937}.score{font-size:42px;font-weight:700}.card{border:1px solid #d8dee8;border-radius:8px;padding:14px;margin:12px 0}pre{background:#111827;color:#f9fafb;padding:12px;border-radius:8px;white-space:pre-wrap}</style>",
    "</head><body>",
    `<h1>Fabric Change Assurance</h1><div class="card"><div>Workspace</div><strong>${escapeHtml(String(report.workspaceId))}</strong></div>`,
    `<div class="card"><div>Score</div><div class="score">${escapeHtml(String(score.score ?? "n/a"))}</div><div>${escapeHtml(String(score.decision ?? ""))}</div></div>`,
    `<pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>`,
    "</body></html>"
  ].join("");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
