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
import {
  buildApprovalChainEvidence,
  buildReleaseRiskMatrix,
  detectAuditAnomalies,
  analyzeOwnershipCoverage,
  assessRollbackReadiness,
  buildAccessRecertificationPacket,
  buildOperatorActionQueue,
  checkChangeFreezeWindow,
  detectReleaseCalendarCollisions,
  estimateBusinessImpact,
  evaluateOperationalSlo,
  evaluateReleaseReadiness,
  evaluatePolicyException,
  forecastCapacityCostRisk,
  generateComplianceEvidenceBundle,
  generateExecutiveReleaseBrief,
  generateRecoveryDrill,
  identifyDependencyBottlenecks,
  reviewDataContracts,
  reviewDataSensitivity,
  simulateWhatIfDeployment,
  scoreWorkspaceCriticality,
  scoreControlMaturity,
  summarizeTenantPosture,
  suggestLeastPrivilegeRoles,
  sha256
} from "../usp.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

export function registerAdvancedUspTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_build_approval_chain_evidence",
    "Build deterministic approval-chain evidence from approval packet, required approvers, and local audit entries.",
    {
      approvalPacket: z.record(z.unknown()).optional(),
      requiredApprovers: z.array(z.string().min(1)).optional(),
      expiresAt: z.string().optional(),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ approvalPacket, requiredApprovers, expiresAt, auditLimit }) =>
      safeTool(async () => buildApprovalChainEvidence({ approvalPacket, requiredApprovers, expiresAt, audit: await context.audit.read(auditLimit) }))
  );

  server.tool(
    "fabric_forecast_capacity_cost_risk",
    "Forecast deployment capacity and cost risk from real workspace/capacity metadata plus explicit planned-action estimates.",
    {
      workspaceId: UuidSchema,
      capacityId: UuidSchema.optional(),
      plannedActions: z.array(z.object({
        type: z.string().optional(),
        itemCount: z.number().int().nonnegative().optional(),
        estimatedCpuSeconds: z.number().nonnegative().optional(),
        estimatedDurationMinutes: z.number().nonnegative().optional()
      })).optional()
    },
    ({ workspaceId, capacityId, plannedActions }) =>
      safeTool(async () => {
        const workspace = await context.client.request(`/workspaces/${workspaceId}`);
        const resolvedCapacityId = capacityId ?? stringValue((workspace.data as Record<string, unknown>).capacityId);
        const [capacities, capacity] = await Promise.all([
          context.client.request("/capacities"),
          resolvedCapacityId ? context.client.request(`/capacities/${resolvedCapacityId}`) : Promise.resolve(undefined)
        ]);
        return {
          workspaceId,
          capacityId: resolvedCapacityId,
          workspace: workspace.data,
          capacity: capacity?.data,
          forecast: forecastCapacityCostRisk({ workspace: workspace.data, capacity: capacity?.data, capacities: capacities.data, plannedActions })
        };
      })
  );

  server.tool(
    "fabric_map_workspace_blast_radius",
    "Map workspace blast radius from real item inventory, definitions, and optional changed item IDs.",
    {
      workspaceId: UuidSchema,
      changedItemIds: z.array(UuidSchema).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(50)
    },
    ({ workspaceId, changedItemIds, maxItems }) =>
      safeTool(async () => {
        const itemsResponse = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(itemsResponse.data);
        const definitions = await fetchDefinitions(context, workspaceId, items.slice(0, maxItems));
        let graph = enrichGraphFromDefinitions(buildDependencyGraphFromItems(items, workspaceId), definitions);
        graph = enrichGraphFromKnownReferences(graph, referencesFromDefinitions(definitions));
        const defaultChanged = graph.nodes.slice(0, 1).map((node) => node.id);
        const blastRadius = analyzeBlastRadius(graph, changedItemIds && changedItemIds.length > 0 ? changedItemIds : defaultChanged);
        return {
          workspaceId,
          evidence: {
            itemCount: items.length,
            definitionsRead: definitions.length,
            changedItemIds: changedItemIds ?? defaultChanged
          },
          graph,
          blastRadius,
          checksum: sha256({ graph, blastRadius })
        };
      })
  );

  server.tool(
    "fabric_review_data_sensitivity",
    "Review returned Fabric metadata, item definitions, and connections for sensitivity indicators without exposing secrets or writing policy.",
    {
      workspaceId: UuidSchema,
      itemIds: z.array(UuidSchema).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(25),
      includeDefinitions: z.boolean().optional().default(true),
      includeConnections: z.boolean().optional().default(true)
    },
    ({ workspaceId, itemIds, maxItems, includeDefinitions, includeConnections }) =>
      safeTool(async () => {
        const itemsResponse = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(itemsResponse.data);
        const selected = itemIds
          ? items.filter((item) => itemIds.includes(String((item as Record<string, unknown> | undefined)?.id)))
          : items.slice(0, maxItems);
        const definitions = includeDefinitions ? await fetchDefinitions(context, workspaceId, selected) : [];
        const connections = includeConnections ? await readConnections(context, workspaceId, selected) : [];
        return {
          workspaceId,
          evidence: { itemCount: selected.length, definitionsRead: definitions.length, connectionsRead: connections.length },
          sensitivity: reviewDataSensitivity({ items: selected, definitions, connections })
        };
      })
  );

  server.tool(
    "fabric_release_readiness_gate",
    "Combine assurance, approval, drift, incident, sensitivity, and capacity evidence into a release gate decision.",
    {
      assuranceScore: z.record(z.unknown()).optional(),
      approvalEvidence: z.record(z.unknown()).optional(),
      environmentDrift: z.record(z.unknown()).optional(),
      incidentReadiness: z.record(z.unknown()).optional(),
      sensitivityReview: z.record(z.unknown()).optional(),
      capacityRisk: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => evaluateReleaseReadiness(input))
  );

  server.tool(
    "fabric_generate_compliance_evidence_bundle",
    "Generate a checksum-backed compliance evidence bundle from assurance, approval, policy, drift, sensitivity, capacity, release gate, and audit evidence.",
    {
      subject: z.record(z.unknown()).optional(),
      changeAssurance: z.record(z.unknown()).optional(),
      approvalEvidence: z.record(z.unknown()).optional(),
      policySimulation: z.record(z.unknown()).optional(),
      environmentDrift: z.record(z.unknown()).optional(),
      sensitivityReview: z.record(z.unknown()).optional(),
      capacityRisk: z.record(z.unknown()).optional(),
      releaseGate: z.record(z.unknown()).optional(),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    async ({ auditLimit, ...input }) =>
      safeTool(async () => generateComplianceEvidenceBundle({ ...input, audit: await context.audit.read(auditLimit) }))
  );

  server.tool(
    "fabric_detect_audit_anomalies",
    "Detect unusual or high-risk local Fabric audit patterns such as blocked bursts, admin preview use, and production-like confirmed actions.",
    {
      auditLimit: z.number().int().positive().max(500).optional().default(100)
    },
    ({ auditLimit }) => safeTool(async () => detectAuditAnomalies(await context.audit.read(auditLimit)))
  );

  server.tool(
    "fabric_suggest_least_privilege_roles",
    "Suggest least-privilege role reviews from real workspace role assignments for a requested operation.",
    {
      workspaceId: UuidSchema,
      operation: z.enum(["read", "deploy", "incident", "admin"]).optional().default("read"),
      currentUser: z.string().optional()
    },
    ({ workspaceId, operation, currentUser }) =>
      safeTool(async () => {
        const roleAssignments = await context.client.request(`/workspaces/${workspaceId}/roleAssignments`);
        return { workspaceId, operation, leastPrivilege: suggestLeastPrivilegeRoles({ roleAssignments: roleAssignments.data, operation, currentUser }) };
      })
  );

  server.tool(
    "fabric_evaluate_policy_exception",
    "Evaluate a proposed policy exception without saving it, requiring reason, expiry, scope, and compensating controls.",
    {
      reason: z.string().optional(),
      expiresAt: z.string().optional(),
      scope: z.record(z.unknown()).optional(),
      compensatingControls: z.array(z.string()).optional(),
      requestedBy: z.string().optional()
    },
    (input) => safeTool(async () => evaluatePolicyException(input))
  );

  server.tool(
    "fabric_build_release_risk_matrix",
    "Build a compact release risk matrix from assurance, approval, capacity, sensitivity, drift, audit, and policy exception evidence.",
    {
      assuranceScore: z.record(z.unknown()).optional(),
      approvalEvidence: z.record(z.unknown()).optional(),
      capacityRisk: z.record(z.unknown()).optional(),
      sensitivityReview: z.record(z.unknown()).optional(),
      environmentDrift: z.record(z.unknown()).optional(),
      auditAnomalies: z.record(z.unknown()).optional(),
      policyException: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => buildReleaseRiskMatrix(input))
  );

  server.tool(
    "fabric_simulate_what_if_deployment",
    "Simulate likely deployment outcome from policy, drift, blast-radius, and changed-item evidence without executing a mutation.",
    {
      itemCount: z.number().int().nonnegative().optional(),
      changedItems: z.array(z.record(z.unknown())).optional(),
      policyEvaluation: z.record(z.unknown()).optional(),
      environmentDrift: z.record(z.unknown()).optional(),
      blastRadius: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => simulateWhatIfDeployment(input))
  );

  server.tool(
    "fabric_assess_rollback_readiness",
    "Assess rollback readiness from real workspace Git status, exported definitions, and recent audit evidence.",
    {
      workspaceId: UuidSchema,
      itemIds: z.array(UuidSchema).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(25),
      auditLimit: z.number().int().positive().max(200).optional().default(50)
    },
    ({ workspaceId, itemIds, maxItems, auditLimit }) =>
      safeTool(async () => {
        const [itemsResponse, gitStatus, audit] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.audit.read(auditLimit)
        ]);
        const items = valuesArray(itemsResponse.data);
        const selected = itemIds
          ? items.filter((item) => itemIds.includes(String((item as Record<string, unknown> | undefined)?.id)))
          : items.slice(0, maxItems);
        const definitions = await fetchDefinitions(context, workspaceId, selected);
        return { workspaceId, rollbackReadiness: assessRollbackReadiness({ gitStatus: gitStatus.data, definitions, audit }) };
      })
  );

  server.tool(
    "fabric_analyze_ownership_coverage",
    "Analyze workspace ownership coverage from real item inventory and role assignment evidence.",
    {
      workspaceId: UuidSchema
    },
    ({ workspaceId }) =>
      safeTool(async () => {
        const [itemsResponse, roleAssignments] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/roleAssignments`)
        ]);
        return {
          workspaceId,
          ownershipCoverage: analyzeOwnershipCoverage({ items: valuesArray(itemsResponse.data), roleAssignments: roleAssignments.data })
        };
      })
  );

  server.tool(
    "fabric_review_data_contracts",
    "Review Fabric item definitions for data-contract signals such as schema, version, table, and column terms.",
    {
      workspaceId: UuidSchema,
      itemIds: z.array(UuidSchema).optional(),
      requiredTerms: z.array(z.string().min(1)).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, itemIds, requiredTerms, maxItems }) =>
      safeTool(async () => {
        const itemsResponse = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(itemsResponse.data);
        const selected = itemIds
          ? items.filter((item) => itemIds.includes(String((item as Record<string, unknown> | undefined)?.id)))
          : items.slice(0, maxItems);
        const definitions = await fetchDefinitions(context, workspaceId, selected);
        return { workspaceId, dataContracts: reviewDataContracts({ definitions, requiredTerms }) };
      })
  );

  server.tool(
    "fabric_summarize_tenant_posture",
    "Summarize tenant-level posture from real workspace inventory, capacity metadata, and active local policy.",
    {},
    () =>
      safeTool(async () => {
        const [workspaces, capacities, policy] = await Promise.all([
          context.client.request("/workspaces"),
          context.client.request("/capacities"),
          context.policy.load()
        ]);
        return summarizeTenantPosture({ workspaces: workspaces.data, capacities: capacities.data, policy });
      })
  );

  server.tool(
    "fabric_evaluate_operational_slo",
    "Evaluate operational SLO from supplied job evidence and recent local audit status signals.",
    {
      jobs: z.array(z.record(z.unknown())).optional(),
      targetSuccessRate: z.number().positive().max(100).optional().default(95),
      auditLimit: z.number().int().positive().max(500).optional().default(100)
    },
    ({ jobs, targetSuccessRate, auditLimit }) =>
      safeTool(async () => evaluateOperationalSlo({ jobs, targetSuccessRate, audit: await context.audit.read(auditLimit) }))
  );

  server.tool(
    "fabric_score_workspace_criticality",
    "Score workspace criticality from real item inventory, role assignments, recent audit, and optional capacity risk evidence.",
    {
      workspaceId: UuidSchema,
      capacityRisk: z.record(z.unknown()).optional(),
      auditLimit: z.number().int().positive().max(500).optional().default(100)
    },
    ({ workspaceId, capacityRisk, auditLimit }) =>
      safeTool(async () => {
        const [itemsResponse, roleAssignments, audit] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/roleAssignments`),
          context.audit.read(auditLimit)
        ]);
        return {
          workspaceId,
          criticality: scoreWorkspaceCriticality({
            items: valuesArray(itemsResponse.data),
            roleAssignments: roleAssignments.data,
            audit,
            capacityRisk
          })
        };
      })
  );

  server.tool(
    "fabric_check_change_freeze_window",
    "Check whether a proposed change is currently blocked by explicit freeze-window evidence.",
    {
      environmentLabel: z.string().optional(),
      now: z.string().optional(),
      freezeWindows: z.array(z.object({
        name: z.string().optional(),
        start: z.string(),
        end: z.string(),
        environmentLabels: z.array(z.string()).optional()
      })).optional()
    },
    (input) => safeTool(async () => checkChangeFreezeWindow(input))
  );

  server.tool(
    "fabric_build_access_recertification_packet",
    "Build a checksum-backed access recertification packet from real workspace role assignments.",
    {
      workspaceId: UuidSchema
    },
    ({ workspaceId }) =>
      safeTool(async () => {
        const roleAssignments = await context.client.request(`/workspaces/${workspaceId}/roleAssignments`);
        return buildAccessRecertificationPacket({ workspaceId, roleAssignments: roleAssignments.data });
      })
  );

  server.tool(
    "fabric_generate_executive_release_brief",
    "Generate an executive release brief from release gate, risk matrix, workspace criticality, and operational SLO evidence.",
    {
      title: z.string().optional(),
      releaseGate: z.record(z.unknown()).optional(),
      riskMatrix: z.record(z.unknown()).optional(),
      criticality: z.record(z.unknown()).optional(),
      operationalSlo: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => generateExecutiveReleaseBrief(input))
  );

  server.tool(
    "fabric_build_operator_action_queue",
    "Build a prioritized operator action queue from release gate, risk matrix, rollback, ownership, contract, and SLO evidence.",
    {
      releaseGate: z.record(z.unknown()).optional(),
      riskMatrix: z.record(z.unknown()).optional(),
      rollbackReadiness: z.record(z.unknown()).optional(),
      ownershipCoverage: z.record(z.unknown()).optional(),
      dataContracts: z.record(z.unknown()).optional(),
      operationalSlo: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => buildOperatorActionQueue(input))
  );

  server.tool(
    "fabric_estimate_business_impact",
    "Estimate business impact from item inventory, criticality, affected users, and optional revenue-at-risk evidence.",
    {
      workspaceId: UuidSchema.optional(),
      items: z.array(z.record(z.unknown())).optional(),
      criticality: z.record(z.unknown()).optional(),
      affectedUsers: z.number().nonnegative().optional(),
      revenueAtRisk: z.number().nonnegative().optional(),
      usage: z.record(z.unknown()).optional()
    },
    async ({ workspaceId, ...input }) =>
      safeTool(async () => {
        const items = workspaceId ? valuesArray((await context.client.request(`/workspaces/${workspaceId}/items`)).data) : input.items;
        return { workspaceId, businessImpact: estimateBusinessImpact({ ...input, items }) };
      })
  );

  server.tool(
    "fabric_identify_dependency_bottlenecks",
    "Identify high fan-in or fan-out bottlenecks from a Fabric dependency graph.",
    {
      graph: z.object({
        nodes: z.array(z.record(z.unknown())).optional(),
        edges: z.array(z.record(z.unknown())).optional()
      })
    },
    ({ graph }) => safeTool(async () => identifyDependencyBottlenecks({ graph }))
  );

  server.tool(
    "fabric_detect_release_calendar_collisions",
    "Detect release calendar collisions from proposed and existing release windows without writing schedules.",
    {
      proposedStart: z.string(),
      proposedEnd: z.string(),
      existingReleases: z.array(z.record(z.unknown())).optional()
    },
    (input) => safeTool(async () => detectReleaseCalendarCollisions(input))
  );

  server.tool(
    "fabric_generate_recovery_drill",
    "Generate a recovery drill plan from rollback readiness and incident brief evidence.",
    {
      rollbackReadiness: z.record(z.unknown()).optional(),
      incidentBrief: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => generateRecoveryDrill(input))
  );

  server.tool(
    "fabric_score_control_maturity",
    "Score release control maturity from supplied assurance, policy, drift, approval, gate, compliance, rollback, and SLO evidence.",
    {
      changeAssurance: z.record(z.unknown()).optional(),
      policySimulation: z.record(z.unknown()).optional(),
      environmentDrift: z.record(z.unknown()).optional(),
      approvalEvidence: z.record(z.unknown()).optional(),
      releaseGate: z.record(z.unknown()).optional(),
      complianceBundle: z.record(z.unknown()).optional(),
      rollbackReadiness: z.record(z.unknown()).optional(),
      operationalSlo: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => scoreControlMaturity(input))
  );
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

async function readConnections(context: ToolContext, workspaceId: string, items: unknown[]) {
  const results = [];
  for (const item of items) {
    const itemId = stringValue((item as Record<string, unknown> | undefined)?.id);
    if (!itemId) continue;
    results.push({ itemId, connections: (await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/connections`)).data });
  }
  return results;
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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
