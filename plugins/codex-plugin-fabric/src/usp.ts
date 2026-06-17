import { createHash } from "node:crypto";
import { FabricPolicy } from "./policy.js";

export interface AssuranceScoreInput {
  blockers?: string[];
  warnings?: string[];
  riskLevel?: "low" | "medium" | "high";
  changedParts?: number;
  affectedNodes?: number;
  hasCleanGit?: boolean;
  hasApproval?: boolean;
  capacitySignals?: Array<{ severity?: string }>;
}

export function calculateAssuranceScore(input: AssuranceScoreInput) {
  const reasons: string[] = [];
  const blockers = [...(input.blockers ?? [])];
  let score = 100;

  if (blockers.length > 0) {
    score -= 35;
    reasons.push(`${blockers.length} blocker(s) must be resolved.`);
  }
  if (input.riskLevel === "high") {
    score -= 25;
    reasons.push("Risk level is high.");
  } else if (input.riskLevel === "medium") {
    score -= 10;
    reasons.push("Risk level is medium.");
  }
  if ((input.changedParts ?? 0) > 10) {
    score -= 15;
    reasons.push("Definition change is broad.");
  }
  if ((input.affectedNodes ?? 0) > 5) {
    score -= 15;
    reasons.push("Blast radius affects more than five nodes.");
  }
  if (input.hasCleanGit === false) {
    score -= 15;
    reasons.push("Git status is not clean.");
  }
  if (input.hasApproval === false) {
    score -= 10;
    reasons.push("Approval packet is missing.");
  }
  if ((input.capacitySignals ?? []).some((signal) => signal.severity === "high")) {
    score -= 15;
    reasons.push("Capacity evidence contains high-severity signals.");
  }
  if ((input.warnings ?? []).length > 0) {
    score -= Math.min(10, (input.warnings ?? []).length * 2);
    reasons.push(`${input.warnings?.length} warning(s) detected.`);
  }
  if (reasons.length === 0) reasons.push("No elevated assurance risks detected.");

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    score: normalizedScore,
    decision: normalizedScore >= 80 && blockers.length === 0 ? "ready" : normalizedScore >= 60 ? "review" : "blocked",
    reasons,
    blockers,
    requiredConditions: requiredConditions(input)
  };
}

export function diffPolicies(left: FabricPolicy, right: FabricPolicy) {
  const changed: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const field of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const before = (left as unknown as Record<string, unknown>)[field];
    const after = (right as unknown as Record<string, unknown>)[field];
    if (stableStringify(before) !== stableStringify(after)) changed.push({ field, before, after });
  }

  return {
    changed,
    newlyAllowed: changed.filter((entry) => makesMorePermissive(entry.before, entry.after)).map((entry) => entry.field),
    newlyBlocked: changed.filter((entry) => makesMoreRestrictive(entry.before, entry.after)).map((entry) => entry.field)
  };
}

export interface WorkspaceFingerprintInput {
  workspaceId: string;
  items: unknown[];
  definitions?: Array<{ itemId: string; definition: unknown }>;
  connections?: unknown[];
  gitStatus?: unknown;
  roleAssignments?: unknown;
  capacity?: unknown;
}

export function buildWorkspaceFingerprint(input: WorkspaceFingerprintInput) {
  const itemFingerprints = input.items
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      id: stringValue(item.id),
      displayName: stringValue(item.displayName) ?? stringValue(item.name),
      type: stringValue(item.type),
      checksum: sha256(item)
    }))
    .sort((a, b) => `${a.type}:${a.displayName}:${a.id}`.localeCompare(`${b.type}:${b.displayName}:${b.id}`));
  const definitionFingerprints = (input.definitions ?? [])
    .map((entry) => ({ itemId: entry.itemId, checksum: sha256(entry.definition) }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
  const body = {
    workspaceId: input.workspaceId,
    items: itemFingerprints,
    definitions: definitionFingerprints,
    connectionsChecksum: sha256(input.connections ?? []),
    gitChecksum: sha256(input.gitStatus ?? {}),
    roleChecksum: sha256(input.roleAssignments ?? {}),
    capacityChecksum: sha256(input.capacity ?? {})
  };

  return {
    ...body,
    checksum: sha256(body)
  };
}

export function compareWorkspaceFingerprints(left: ReturnType<typeof buildWorkspaceFingerprint>, right: ReturnType<typeof buildWorkspaceFingerprint>) {
  const leftItems = new Map(left.items.map((item) => [item.id ?? `${item.type}:${item.displayName}`, item]));
  const rightItems = new Map(right.items.map((item) => [item.id ?? `${item.type}:${item.displayName}`, item]));
  const missingInRight = [...leftItems.keys()].filter((key) => !rightItems.has(key));
  const missingInLeft = [...rightItems.keys()].filter((key) => !leftItems.has(key));
  const changedItems = [...leftItems.entries()]
    .filter(([key, item]) => rightItems.has(key) && rightItems.get(key)?.checksum !== item.checksum)
    .map(([key]) => key);
  const definitionDrift = compareChecksums(left.definitions, right.definitions, "itemId");

  return {
    equal: left.checksum === right.checksum,
    missingInRight,
    missingInLeft,
    changedItems,
    definitionDrift,
    connectionDrift: left.connectionsChecksum !== right.connectionsChecksum,
    gitDrift: left.gitChecksum !== right.gitChecksum,
    roleDrift: left.roleChecksum !== right.roleChecksum,
    capacityDrift: left.capacityChecksum !== right.capacityChecksum
  };
}

export interface TimelineEvent {
  timestamp: string;
  source: string;
  severity: "low" | "medium" | "high";
  message: string;
  evidence?: unknown;
}

export function sortTimeline(events: TimelineEvent[]) {
  return [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function rankRootCauses(events: TimelineEvent[]) {
  const groups = new Map<string, { score: number; evidence: TimelineEvent[] }>();
  for (const event of events) {
    const key = classifyCause(event);
    const current = groups.get(key) ?? { score: 0, evidence: [] };
    current.score += event.severity === "high" ? 3 : event.severity === "medium" ? 2 : 1;
    current.evidence.push(event);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([cause, value]) => ({
      cause,
      confidence: Math.min(1, value.score / 10),
      evidenceCount: value.evidence.length,
      evidence: value.evidence
    }))
    .sort((a, b) => b.confidence - a.confidence || b.evidenceCount - a.evidenceCount);
}

export interface ApprovalChainInput {
  approvalPacket?: Record<string, unknown>;
  audit?: unknown[];
  requiredApprovers?: string[];
  expiresAt?: string;
}

export function buildApprovalChainEvidence(input: ApprovalChainInput) {
  const packet = input.approvalPacket ?? {};
  const requiredApprovers = input.requiredApprovers ?? stringArray(packet.requiredApprovers);
  const approvals = collectApprovals(packet, input.audit ?? []);
  const approvedBy = [...new Set(approvals.map((approval) => approval.approver).filter(Boolean))];
  const missingApprovers = requiredApprovers.filter((approver) => !approvedBy.includes(approver));
  const expiresAt = stringValue(input.expiresAt) ?? stringValue(packet.expiresAt);
  const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
  const blockers = [];
  if (!packet.approvalId && approvals.length === 0) blockers.push("No approval packet or approval audit evidence was provided.");
  if (missingApprovers.length > 0) blockers.push(`Missing approval from ${missingApprovers.join(", ")}.`);
  if (expired) blockers.push("Approval evidence is expired.");
  const evidence = {
    approvalId: stringValue(packet.approvalId),
    requiredApprovers,
    approvedBy,
    missingApprovers,
    expiresAt,
    expired,
    approvals,
    status: blockers.length === 0 ? "complete" : "incomplete",
    blockers
  };
  return { ...evidence, checksum: sha256(evidence) };
}

export interface CapacityCostForecastInput {
  workspace?: unknown;
  capacity?: unknown;
  capacities?: unknown;
  plannedActions?: Array<{ type?: string; itemCount?: number; estimatedCpuSeconds?: number; estimatedDurationMinutes?: number }>;
}

export function forecastCapacityCostRisk(input: CapacityCostForecastInput) {
  const plannedActions = input.plannedActions ?? [];
  const text = stableStringify({ workspace: input.workspace, capacity: input.capacity, capacities: input.capacities }).toLowerCase();
  const signals: Array<{ severity: "low" | "medium" | "high"; message: string; evidence?: unknown }> = [];
  if (text.includes("paused")) signals.push({ severity: "high", message: "Capacity metadata indicates paused state." });
  if (text.includes("unavailable") || text.includes("failed")) signals.push({ severity: "high", message: "Capacity metadata contains failure or unavailable signals." });
  if (text.includes("trial")) signals.push({ severity: "medium", message: "Capacity metadata indicates trial capacity." });
  const totalItems = plannedActions.reduce((sum, action) => sum + (action.itemCount ?? 0), 0);
  const cpuSeconds = plannedActions.reduce((sum, action) => sum + (action.estimatedCpuSeconds ?? 0), 0);
  const durationMinutes = plannedActions.reduce((sum, action) => sum + (action.estimatedDurationMinutes ?? 0), 0);
  if (totalItems > 50) signals.push({ severity: "medium", message: "Planned action touches more than 50 items.", evidence: { totalItems } });
  if (cpuSeconds > 3600 || durationMinutes > 120) signals.push({ severity: "medium", message: "Planned action has elevated estimated compute or duration.", evidence: { cpuSeconds, durationMinutes } });
  if (signals.length === 0) signals.push({ severity: "low", message: "No capacity or planned-action risk signals found." });
  const riskScore = Math.min(100, signals.reduce((score, signal) => score + (signal.severity === "high" ? 40 : signal.severity === "medium" ? 18 : 4), 0));
  return {
    riskScore,
    riskLevel: riskScore >= 60 ? "high" : riskScore >= 25 ? "medium" : "low",
    plannedActionSummary: { actionCount: plannedActions.length, totalItems, cpuSeconds, durationMinutes },
    signals
  };
}

export interface SensitivityReviewInput {
  items?: unknown[];
  definitions?: Array<{ itemId?: string; definition?: unknown }>;
  connections?: unknown[];
}

export function reviewDataSensitivity(input: SensitivityReviewInput) {
  const findings: Array<{ severity: "low" | "medium" | "high"; category: string; itemId?: string; evidence: string }> = [];
  for (const item of input.items ?? []) {
    const record = item as Record<string, unknown>;
    scanSensitivityText(`${record.displayName ?? ""} ${record.name ?? ""} ${record.type ?? ""}`, stringValue(record.id), findings);
  }
  for (const entry of input.definitions ?? []) {
    scanSensitivityText(stableStringify(entry.definition), entry.itemId, findings);
  }
  for (const connection of input.connections ?? []) {
    scanSensitivityText(stableStringify(connection), undefined, findings);
  }
  const high = findings.filter((finding) => finding.severity === "high").length;
  const medium = findings.filter((finding) => finding.severity === "medium").length;
  return {
    status: high > 0 ? "restricted-review" : medium > 0 ? "review" : "clear",
    findingCount: findings.length,
    findings,
    requiredConditions: high > 0
      ? ["Validate data classification and approver sign-off before release."]
      : medium > 0
        ? ["Review sensitivity findings before release."]
        : ["No sensitivity terms were found in returned metadata or definitions."]
  };
}

export function evaluateReleaseReadiness(input: Record<string, unknown>) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const assurance = input.assuranceScore as Record<string, unknown> | undefined;
  const approval = input.approvalEvidence as Record<string, unknown> | undefined;
  const capacity = input.capacityRisk as Record<string, unknown> | undefined;
  const sensitivity = input.sensitivityReview as Record<string, unknown> | undefined;
  const drift = input.environmentDrift as Record<string, unknown> | undefined;
  const incident = input.incidentReadiness as Record<string, unknown> | undefined;

  if (Number(assurance?.score ?? 0) < 60 || assurance?.decision === "blocked") blockers.push("Change assurance score blocks release.");
  else if (Number(assurance?.score ?? 100) < 80 || assurance?.decision === "review") warnings.push("Change assurance requires review.");
  if (approval?.status === "incomplete") blockers.push("Approval chain is incomplete.");
  if (capacity?.riskLevel === "high") blockers.push("Capacity or cost forecast is high risk.");
  else if (capacity?.riskLevel === "medium") warnings.push("Capacity or cost forecast is medium risk.");
  if (sensitivity?.status === "restricted-review") blockers.push("Sensitivity review requires restricted approval.");
  else if (sensitivity?.status === "review") warnings.push("Sensitivity review has findings.");
  if (drift?.equal === false) warnings.push("Environment drift is present.");
  if (incident && stableStringify(incident).toLowerCase().includes("high")) warnings.push("Incident evidence contains high-severity signals.");

  return {
    decision: blockers.length > 0 ? "no-go" : warnings.length > 0 ? "conditional-go" : "go",
    blockers,
    warnings,
    requiredConditions: blockers.length > 0
      ? blockers.map((blocker) => `Resolve: ${blocker}`)
      : warnings.length > 0
        ? warnings.map((warning) => `Approve condition: ${warning}`)
        : ["Proceed through guarded mutation tooling with final evidence capture."]
  };
}

export function generateComplianceEvidenceBundle(input: Record<string, unknown>) {
  const sections = [
    evidenceSection("changeAssurance", input.changeAssurance),
    evidenceSection("approvalEvidence", input.approvalEvidence),
    evidenceSection("policySimulation", input.policySimulation),
    evidenceSection("environmentDrift", input.environmentDrift),
    evidenceSection("sensitivityReview", input.sensitivityReview),
    evidenceSection("capacityRisk", input.capacityRisk),
    evidenceSection("releaseGate", input.releaseGate),
    evidenceSection("audit", input.audit)
  ];
  const missingSections = sections.filter((section) => !section.present).map((section) => section.name);
  const bundle = {
    createdAt: new Date().toISOString(),
    subject: input.subject ?? {},
    sections,
    completeness: Math.round(((sections.length - missingSections.length) / sections.length) * 100),
    missingSections
  };
  return { ...bundle, checksum: sha256(bundle) };
}

export function detectAuditAnomalies(audit: unknown[]) {
  const entries = audit.map((entry) => entry as Record<string, unknown>);
  const anomalies: Array<{ severity: "low" | "medium" | "high"; category: string; message: string; evidence: unknown }> = [];
  const byTool = new Map<string, number>();
  const byActor = new Map<string, number>();
  for (const entry of entries) {
    const tool = stringValue(entry.tool) ?? "unknown";
    const actor = stringValue(entry.actor) ?? stringValue(entry.user) ?? "unknown";
    byTool.set(tool, (byTool.get(tool) ?? 0) + 1);
    byActor.set(actor, (byActor.get(actor) ?? 0) + 1);
    const text = stableStringify(entry).toLowerCase();
    if (text.includes("failed") || text.includes("blocked")) anomalies.push({ severity: "medium", category: "failed-or-blocked", message: "Audit entry contains failed or blocked status.", evidence: entry });
    if (text.includes("production") && text.includes("confirm")) anomalies.push({ severity: "high", category: "production-mutation", message: "Audit entry references confirmed production-like action.", evidence: entry });
    if (text.includes("admin")) anomalies.push({ severity: "medium", category: "admin-preview", message: "Audit entry references admin preview usage.", evidence: entry });
  }
  for (const [tool, count] of byTool) {
    if (count >= 10) anomalies.push({ severity: "medium", category: "tool-burst", message: `${tool} appears ${count} time(s) in the audit sample.`, evidence: { tool, count } });
  }
  for (const [actor, count] of byActor) {
    if (actor !== "unknown" && count >= 10) anomalies.push({ severity: "low", category: "actor-burst", message: `${actor} appears ${count} time(s) in the audit sample.`, evidence: { actor, count } });
  }
  return {
    entryCount: entries.length,
    anomalyCount: anomalies.length,
    riskLevel: anomalies.some((entry) => entry.severity === "high") ? "high" : anomalies.some((entry) => entry.severity === "medium") ? "medium" : "low",
    anomalies
  };
}

export function suggestLeastPrivilegeRoles(input: { roleAssignments?: unknown; operation?: string; currentUser?: string }) {
  const assignments = valuesFromUnknown(input.roleAssignments);
  const suggestions = assignments.map((assignment) => {
    const record = assignment as Record<string, unknown>;
    const role = stringValue(record.role) ?? stringValue(record.roleName) ?? "Unknown";
    const principal = stringValue(record.principalId) ?? stringValue(record.userPrincipalName) ?? stringValue(record.displayName) ?? "Unknown";
    const recommendation = leastPrivilegeRecommendation(role, input.operation);
    return {
      principal,
      currentRole: role,
      operation: input.operation ?? "general",
      recommendation,
      severity: recommendation === "retain" ? "low" : role.toLowerCase().includes("admin") ? "high" : "medium"
    };
  });
  return {
    assignmentCount: assignments.length,
    suggestions,
    summary: `${suggestions.filter((entry) => entry.recommendation !== "retain").length} role assignment(s) should be reviewed for least privilege.`
  };
}

export function evaluatePolicyException(input: Record<string, unknown>) {
  const expiresAt = stringValue(input.expiresAt);
  const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;
  const compensatingControls = stringArray(input.compensatingControls);
  const scope = input.scope as Record<string, unknown> | undefined;
  const blockers = [];
  const warnings = [];
  if (!input.reason) blockers.push("Policy exception requires a reason.");
  if (!expiresAt) blockers.push("Policy exception requires an expiry timestamp.");
  if (expired) blockers.push("Policy exception is expired.");
  if (compensatingControls.length === 0) warnings.push("No compensating controls were provided.");
  if (!scope || Object.keys(scope).length === 0) warnings.push("Exception scope is broad or missing.");
  return {
    decision: blockers.length > 0 ? "rejected" : warnings.length > 0 ? "conditional" : "acceptable",
    blockers,
    warnings,
    requiredConditions: blockers.length > 0 ? blockers : warnings,
    checksum: sha256(input)
  };
}

export function buildReleaseRiskMatrix(input: Record<string, unknown>) {
  const categories = [
    riskMatrixEntry("assurance", input.assuranceScore, assuranceSeverity),
    riskMatrixEntry("approval", input.approvalEvidence, approvalSeverity),
    riskMatrixEntry("capacity", input.capacityRisk, capacitySeverity),
    riskMatrixEntry("sensitivity", input.sensitivityReview, sensitivitySeverity),
    riskMatrixEntry("drift", input.environmentDrift, driftSeverity),
    riskMatrixEntry("audit", input.auditAnomalies, auditSeverity),
    riskMatrixEntry("policyException", input.policyException, exceptionSeverity)
  ];
  const score = categories.reduce((sum, category) => sum + (category.severity === "high" ? 30 : category.severity === "medium" ? 15 : 4), 0);
  return {
    score: Math.min(100, score),
    level: score >= 60 ? "high" : score >= 25 ? "medium" : "low",
    categories,
    topRisks: categories.filter((category) => category.severity !== "low")
  };
}

export function simulateWhatIfDeployment(input: Record<string, unknown>) {
  const itemCount = Number(input.itemCount ?? 0);
  const changedItems = valuesFromUnknown(input.changedItems);
  const drift = input.environmentDrift as Record<string, unknown> | undefined;
  const policy = input.policyEvaluation as Record<string, unknown> | undefined;
  const blastRadius = input.blastRadius as Record<string, unknown> | undefined;
  const blockers = [...stringArray(policy?.blockers)];
  const warnings = [...stringArray(policy?.warnings)];
  if (drift?.equal === false) warnings.push("Target environment has drift.");
  if (itemCount > 25 || changedItems.length > 25) warnings.push("Deployment touches a broad item set.");
  if (Array.isArray(blastRadius?.affectedNodes) && blastRadius.affectedNodes.length > 10) warnings.push("Blast radius affects more than ten nodes.");
  return {
    predictedOutcome: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "conditional" : "likely-safe",
    blockers,
    warnings,
    simulatedAt: new Date().toISOString(),
    evidenceChecksum: sha256(input)
  };
}

export function assessRollbackReadiness(input: Record<string, unknown>) {
  const git = stableStringify(input.gitStatus ?? {}).toLowerCase();
  const definitions = valuesFromUnknown(input.definitions);
  const recentAudit = valuesFromUnknown(input.audit);
  const blockers = [];
  const warnings = [];
  if (definitions.length === 0) blockers.push("Rollback readiness requires exported current definitions.");
  if (git.includes("conflict") || git.includes("behind") || git.includes("uncommitted")) warnings.push("Git status is not clean.");
  if (recentAudit.some((entry) => stableStringify(entry).toLowerCase().includes("failed"))) warnings.push("Recent audit contains failed actions.");
  const steps = [
    "Freeze further guarded mutations for the workspace.",
    "Verify target binding and current definition checksums.",
    "Use Git or exported definitions as the rollback source of truth.",
    "Run preflight and release gate again before any corrective mutation.",
    "Finalize rollback evidence with request ID, operation ID, result, and audit."
  ];
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    steps,
    checksum: sha256({ definitions, gitStatus: input.gitStatus, audit: recentAudit })
  };
}

export function analyzeOwnershipCoverage(input: { items?: unknown[]; roleAssignments?: unknown }) {
  const items = input.items ?? [];
  const assignments = valuesFromUnknown(input.roleAssignments);
  const ownerText = stableStringify(assignments).toLowerCase();
  const hasOwner = ownerText.includes("admin") || ownerText.includes("member") || ownerText.includes("owner");
  const orphanedItems = items
    .map((item) => item as Record<string, unknown>)
    .filter((item) => !stringValue(item.owner) && !stringValue(item.createdBy) && !hasOwner)
    .map((item) => ({ id: stringValue(item.id), displayName: stringValue(item.displayName) ?? stringValue(item.name), type: stringValue(item.type) }));
  return {
    itemCount: items.length,
    roleAssignmentCount: assignments.length,
    coverage: items.length === 0 ? 100 : Math.round(((items.length - orphanedItems.length) / items.length) * 100),
    orphanedItems,
    recommendations: orphanedItems.length > 0 ? ["Assign explicit accountable owners or workspace role coverage before release."] : ["Ownership coverage is sufficient from returned evidence."]
  };
}

export function reviewDataContracts(input: { definitions?: Array<{ itemId?: string; definition?: unknown }>; requiredTerms?: string[] }) {
  const requiredTerms = input.requiredTerms ?? ["schema", "version", "table", "column"];
  const reviews = (input.definitions ?? []).map((entry) => {
    const text = stableStringify(entry.definition).toLowerCase();
    const missingTerms = requiredTerms.filter((term) => !text.includes(term.toLowerCase()));
    return {
      itemId: entry.itemId,
      missingTerms,
      status: missingTerms.length === 0 ? "pass" : missingTerms.length <= 2 ? "review" : "fail"
    };
  });
  return {
    reviewedDefinitions: reviews.length,
    status: reviews.some((review) => review.status === "fail") ? "fail" : reviews.some((review) => review.status === "review") ? "review" : "pass",
    reviews
  };
}

export function summarizeTenantPosture(input: Record<string, unknown>) {
  const policy = input.policy as Record<string, unknown> | undefined;
  const capacities = valuesFromUnknown(input.capacities);
  const workspaces = valuesFromUnknown(input.workspaces);
  const adminPreviewEnabled = policy?.allowAdminPreview === true;
  const betaEnabled = policy?.allowBetaApis === true;
  const risks = [];
  if (adminPreviewEnabled) risks.push({ severity: "medium", message: "Policy allows admin preview APIs." });
  if (betaEnabled) risks.push({ severity: "medium", message: "Policy allows beta APIs." });
  if (workspaces.length === 0) risks.push({ severity: "low", message: "No workspace inventory evidence supplied." });
  if (stableStringify(capacities).toLowerCase().includes("paused")) risks.push({ severity: "high", message: "Capacity evidence contains paused state." });
  return {
    workspaceCount: workspaces.length,
    capacityCount: capacities.length,
    posture: risks.some((risk) => risk.severity === "high") ? "weak" : risks.length > 0 ? "review" : "strong",
    risks,
    recommendations: risks.length > 0 ? ["Review tenant policy posture and capacity health before broad rollout."] : ["Tenant posture looks strong from supplied evidence."]
  };
}

export function evaluateOperationalSlo(input: Record<string, unknown>) {
  const jobs = valuesFromUnknown(input.jobs);
  const audit = valuesFromUnknown(input.audit);
  const evidence = [...jobs, ...audit];
  const failed = evidence.filter((entry) => stableStringify(entry).toLowerCase().includes("fail")).length;
  const blocked = evidence.filter((entry) => stableStringify(entry).toLowerCase().includes("blocked")).length;
  const total = evidence.length;
  const successRate = total === 0 ? 100 : Math.round(((total - failed - blocked) / total) * 100);
  const target = Number(input.targetSuccessRate ?? 95);
  return {
    totalSignals: total,
    failed,
    blocked,
    successRate,
    targetSuccessRate: target,
    status: successRate >= target ? "met" : successRate >= target - 5 ? "at-risk" : "missed",
    recommendations: successRate >= target ? ["Operational SLO is met from supplied evidence."] : ["Review failed or blocked operations before release."]
  };
}

export function scoreWorkspaceCriticality(input: Record<string, unknown>) {
  const items = valuesFromUnknown(input.items);
  const roles = valuesFromUnknown(input.roleAssignments);
  const audit = valuesFromUnknown(input.audit);
  const itemTypes = new Set(items.map((item) => stringValue((item as Record<string, unknown>).type) ?? "Unknown"));
  let score = 0;
  if (items.length > 50) score += 25;
  else if (items.length > 10) score += 12;
  if (itemTypes.has("Warehouse") || itemTypes.has("Lakehouse")) score += 20;
  if (itemTypes.has("SemanticModel") || itemTypes.has("Report")) score += 10;
  if (roles.some((role) => stableStringify(role).toLowerCase().includes("admin"))) score += 15;
  if (audit.some((entry) => stableStringify(entry).toLowerCase().includes("production"))) score += 20;
  if (stableStringify(input.capacityRisk).toLowerCase().includes("high")) score += 20;
  const normalized = Math.min(100, score);
  return {
    score: normalized,
    tier: normalized >= 70 ? "tier-1" : normalized >= 35 ? "tier-2" : "tier-3",
    drivers: {
      itemCount: items.length,
      itemTypes: [...itemTypes].sort(),
      roleAssignmentCount: roles.length,
      auditSignals: audit.length
    }
  };
}

export function checkChangeFreezeWindow(input: Record<string, unknown>) {
  const now = Date.parse(stringValue(input.now) ?? new Date().toISOString());
  const windows = valuesFromUnknown(input.freezeWindows).map((window) => window as Record<string, unknown>);
  const active = windows.filter((window) => {
    const start = Date.parse(stringValue(window.start) ?? "");
    const end = Date.parse(stringValue(window.end) ?? "");
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
  });
  const environmentLabel = stringValue(input.environmentLabel)?.toLowerCase() ?? "";
  const applies = active.filter((window) => {
    const labels = stringArray(window.environmentLabels).map((label) => label.toLowerCase());
    return labels.length === 0 || labels.includes(environmentLabel);
  });
  return {
    frozen: applies.length > 0,
    activeWindows: applies,
    decision: applies.length > 0 ? "blocked-by-freeze" : "outside-freeze",
    requiredConditions: applies.length > 0 ? ["Wait until the freeze window ends or attach explicit exception evidence."] : ["No active change freeze applies."]
  };
}

export function buildAccessRecertificationPacket(input: Record<string, unknown>) {
  const assignments = valuesFromUnknown(input.roleAssignments);
  const privileged = assignments
    .map((assignment) => assignment as Record<string, unknown>)
    .filter((assignment) => {
      const text = stableStringify(assignment).toLowerCase();
      return text.includes("admin") || text.includes("member") || text.includes("contributor");
    });
  const packet = {
    workspaceId: input.workspaceId,
    generatedAt: new Date().toISOString(),
    assignmentCount: assignments.length,
    privilegedCount: privileged.length,
    privilegedAssignments: privileged,
    reviewRequired: privileged.length > 0,
    requiredActions: privileged.length > 0
      ? ["Review every privileged assignment for continued business need.", "Record reviewer, decision, and expiry for temporary elevated access."]
      : ["No privileged assignments found in returned evidence."]
  };
  return { ...packet, checksum: sha256(packet) };
}

export function generateExecutiveReleaseBrief(input: Record<string, unknown>) {
  const gate = input.releaseGate as Record<string, unknown> | undefined;
  const matrix = input.riskMatrix as Record<string, unknown> | undefined;
  const criticality = input.criticality as Record<string, unknown> | undefined;
  const slo = input.operationalSlo as Record<string, unknown> | undefined;
  const decision = stringValue(gate?.decision) ?? "unknown";
  const bullets = [
    `Release decision: ${decision}.`,
    `Risk level: ${String(matrix?.level ?? "unknown")}.`,
    `Workspace criticality: ${String(criticality?.tier ?? "unknown")}.`,
    `Operational SLO: ${String(slo?.status ?? "unknown")}.`
  ];
  const blockers = stringArray(gate?.blockers);
  const warnings = stringArray(gate?.warnings);
  return {
    title: input.title ?? "Fabric Release Executive Brief",
    decision,
    summary: bullets.join(" "),
    bullets,
    blockers,
    warnings,
    checksum: sha256({ gate, matrix, criticality, slo, title: input.title })
  };
}

export function buildOperatorActionQueue(input: Record<string, unknown>) {
  const actions: Array<{ priority: "high" | "medium" | "low"; source: string; action: string }> = [];
  collectActions(actions, "releaseGate", input.releaseGate);
  collectActions(actions, "riskMatrix", input.riskMatrix);
  collectActions(actions, "rollbackReadiness", input.rollbackReadiness);
  collectActions(actions, "ownershipCoverage", input.ownershipCoverage);
  collectActions(actions, "dataContracts", input.dataContracts);
  collectActions(actions, "operationalSlo", input.operationalSlo);
  return {
    actionCount: actions.length,
    actions: actions.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
  };
}

export function estimateBusinessImpact(input: Record<string, unknown>) {
  const items = valuesFromUnknown(input.items);
  const criticality = input.criticality as Record<string, unknown> | undefined;
  const usage = input.usage as Record<string, unknown> | undefined;
  const affectedUsers = Number(usage?.affectedUsers ?? input.affectedUsers ?? 0);
  const revenueAtRisk = Number(usage?.revenueAtRisk ?? input.revenueAtRisk ?? 0);
  const criticalityScore = Number(criticality?.score ?? 0);
  const score = Math.min(100, Math.round((items.length > 20 ? 20 : items.length) + criticalityScore * 0.45 + Math.min(30, affectedUsers / 10) + Math.min(30, revenueAtRisk / 10000)));
  return {
    score,
    level: score >= 70 ? "material" : score >= 35 ? "moderate" : "limited",
    drivers: { itemCount: items.length, affectedUsers, revenueAtRisk, criticalityScore },
    narrative: score >= 70 ? "Material business impact should be reviewed by release owners." : score >= 35 ? "Moderate impact requires operator review." : "Limited impact from supplied evidence."
  };
}

export function identifyDependencyBottlenecks(input: Record<string, unknown>) {
  const graph = input.graph as { nodes?: Array<{ id?: string; label?: string; type?: string }>; edges?: Array<{ from?: string; to?: string }> } | undefined;
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const downstream = new Map<string, number>();
  const upstream = new Map<string, number>();
  for (const edge of edges) {
    if (edge.from) downstream.set(edge.from, (downstream.get(edge.from) ?? 0) + 1);
    if (edge.to) upstream.set(edge.to, (upstream.get(edge.to) ?? 0) + 1);
  }
  const bottlenecks = nodes
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      downstreamCount: node.id ? downstream.get(node.id) ?? 0 : 0,
      upstreamCount: node.id ? upstream.get(node.id) ?? 0 : 0
    }))
    .filter((node) => node.downstreamCount >= 3 || node.upstreamCount >= 3)
    .sort((a, b) => (b.downstreamCount + b.upstreamCount) - (a.downstreamCount + a.upstreamCount));
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    bottlenecks,
    recommendations: bottlenecks.length > 0 ? ["Review dependency bottlenecks before release and include owners in approval."] : ["No dependency bottlenecks found in supplied graph."]
  };
}

export function detectReleaseCalendarCollisions(input: Record<string, unknown>) {
  const proposedStart = Date.parse(stringValue(input.proposedStart) ?? "");
  const proposedEnd = Date.parse(stringValue(input.proposedEnd) ?? "");
  const releases = valuesFromUnknown(input.existingReleases).map((entry) => entry as Record<string, unknown>);
  const collisions = releases.filter((release) => {
    const start = Date.parse(stringValue(release.start) ?? "");
    const end = Date.parse(stringValue(release.end) ?? "");
    return Number.isFinite(proposedStart) && Number.isFinite(proposedEnd) && Number.isFinite(start) && Number.isFinite(end) && proposedStart <= end && proposedEnd >= start;
  });
  return {
    collisionCount: collisions.length,
    collisions,
    decision: collisions.length > 0 ? "reschedule-or-approve-exception" : "clear",
    requiredConditions: collisions.length > 0 ? ["Resolve calendar collision or attach explicit release manager exception."] : ["No release calendar collision found."]
  };
}

export function generateRecoveryDrill(input: Record<string, unknown>) {
  const rollback = input.rollbackReadiness as Record<string, unknown> | undefined;
  const incident = input.incidentBrief as Record<string, unknown> | undefined;
  const steps = [
    { id: "detect", action: "Confirm incident signal and affected Fabric workspace/items." },
    { id: "freeze", action: "Freeze guarded mutations for affected scope." },
    { id: "evidence", action: "Collect audit, Git status, operation IDs, job IDs, and definition checksums." },
    { id: "decide", action: "Use release gate and root-cause ranking to choose recover, roll forward, or rollback." },
    { id: "execute", action: "Execute recovery only through guarded tools with target binding." },
    { id: "finalize", action: "Finalize mutation evidence and update operator action queue." }
  ];
  const blockers = [];
  if (rollback?.ready === false) blockers.push("Rollback readiness is not satisfied.");
  if (!incident) blockers.push("Incident brief evidence is missing.");
  return {
    drillId: sha256({ rollback, incident, steps }).slice(0, 16),
    readyForDrill: blockers.length === 0,
    blockers,
    steps
  };
}

export function scoreControlMaturity(input: Record<string, unknown>) {
  const controls = [
    ["changeAssurance", input.changeAssurance],
    ["policySimulation", input.policySimulation],
    ["environmentDrift", input.environmentDrift],
    ["approvalEvidence", input.approvalEvidence],
    ["releaseGate", input.releaseGate],
    ["complianceBundle", input.complianceBundle],
    ["rollbackReadiness", input.rollbackReadiness],
    ["operationalSlo", input.operationalSlo]
  ] as const;
  const present = controls.filter(([, value]) => value !== undefined && value !== null).map(([name]) => name);
  const score = Math.round((present.length / controls.length) * 100);
  return {
    score,
    level: score >= 85 ? "optimized" : score >= 60 ? "managed" : score >= 35 ? "defined" : "initial",
    presentControls: present,
    missingControls: controls.filter(([name]) => !present.includes(name)).map(([name]) => name),
    recommendations: score >= 85 ? ["Control maturity is optimized from supplied evidence."] : ["Add missing evidence controls before enterprise rollout."]
  };
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function requiredConditions(input: AssuranceScoreInput): string[] {
  const conditions = [];
  if ((input.blockers ?? []).length > 0) conditions.push("Resolve all policy, guardrail, and risk blockers.");
  if (input.hasCleanGit === false) conditions.push("Restore clean Git status before mutation.");
  if (input.hasApproval === false) conditions.push("Attach an approval packet.");
  if ((input.capacitySignals ?? []).some((signal) => signal.severity === "high")) conditions.push("Resolve high-severity capacity signals.");
  if (conditions.length === 0) conditions.push("Proceed through guarded mutation tool with explicit target binding.");
  return conditions;
}

function compareChecksums<T extends Record<string, unknown>>(left: T[], right: T[], key: keyof T) {
  const leftMap = new Map(left.map((entry) => [String(entry[key]), entry.checksum]));
  const rightMap = new Map(right.map((entry) => [String(entry[key]), entry.checksum]));
  return {
    missingInRight: [...leftMap.keys()].filter((id) => !rightMap.has(id)),
    missingInLeft: [...rightMap.keys()].filter((id) => !leftMap.has(id)),
    changed: [...leftMap.keys()].filter((id) => rightMap.has(id) && rightMap.get(id) !== leftMap.get(id))
  };
}

function makesMorePermissive(before: unknown, after: unknown): boolean {
  if (before === false && after === true) return true;
  if (Array.isArray(before) && Array.isArray(after) && before.length > after.length) return true;
  return false;
}

function makesMoreRestrictive(before: unknown, after: unknown): boolean {
  if (before === true && after === false) return true;
  if (Array.isArray(before) && Array.isArray(after) && before.length < after.length) return true;
  return false;
}

function classifyCause(event: TimelineEvent): string {
  const text = `${event.source} ${event.message}`.toLowerCase();
  if (text.includes("capacity") || text.includes("paused") || text.includes("unavailable")) return "Capacity";
  if (text.includes("git") || text.includes("conflict")) return "Git";
  if (text.includes("permission") || text.includes("role") || text.includes("403")) return "Permission";
  if (text.includes("connection") || text.includes("gateway")) return "Connection";
  if (text.includes("deploy") || text.includes("operation")) return "Deployment";
  if (text.includes("job") || text.includes("run")) return "Job";
  return "Workspace";
}

function collectApprovals(packet: Record<string, unknown>, audit: unknown[]) {
  const packetApprovals = Array.isArray(packet.approvals) ? packet.approvals : [];
  const auditApprovals = audit
    .map((entry) => entry as Record<string, unknown>)
    .filter((entry) => stableStringify(entry).toLowerCase().includes("approv"))
    .map((entry) => ({
      approver: stringValue(entry.approver) ?? stringValue(entry.user) ?? stringValue(entry.actor),
      approvedAt: stringValue(entry.timestamp),
      evidence: entry
    }));
  return [...packetApprovals.map((approval) => {
    const record = approval as Record<string, unknown>;
    return {
      approver: stringValue(record.approver) ?? stringValue(record.user),
      approvedAt: stringValue(record.approvedAt) ?? stringValue(record.timestamp),
      evidence: record
    };
  }), ...auditApprovals];
}

function scanSensitivityText(text: string, itemId: string | undefined, findings: Array<{ severity: "low" | "medium" | "high"; category: string; itemId?: string; evidence: string }>) {
  const lower = text.toLowerCase();
  const patterns = [
    { category: "credential", severity: "high" as const, terms: ["password", "secret", "token", "apikey", "api_key", "connectionstring"] },
    { category: "personal-data", severity: "medium" as const, terms: ["email", "phone", "ssn", "passport", "birthdate", "customer"] },
    { category: "financial-data", severity: "medium" as const, terms: ["iban", "creditcard", "salary", "revenue", "invoice"] },
    { category: "regulated-health", severity: "high" as const, terms: ["patient", "diagnosis", "medical", "hipaa"] }
  ];
  for (const pattern of patterns) {
    const term = pattern.terms.find((candidate) => lower.includes(candidate));
    if (term) findings.push({ severity: pattern.severity, category: pattern.category, itemId, evidence: `Matched term "${term}" in returned metadata or definition text.` });
  }
}

function evidenceSection(name: string, value: unknown) {
  return {
    name,
    present: value !== undefined && value !== null,
    checksum: value === undefined || value === null ? undefined : sha256(value),
    summary: value === undefined || value === null ? "Missing" : summarizeEvidence(value)
  };
}

function summarizeEvidence(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === "object") return `${Object.keys(value as Record<string, unknown>).length} field(s)`;
  return String(value);
}

function valuesFromUnknown(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.value)) return record.value;
    if (Array.isArray(record.roleAssignments)) return record.roleAssignments;
  }
  return [];
}

function leastPrivilegeRecommendation(role: string, operation?: string): string {
  const lower = role.toLowerCase();
  if (operation === "deploy" && lower.includes("admin")) return "review-admin-to-contributor";
  if (operation === "read" && (lower.includes("admin") || lower.includes("contributor") || lower.includes("member"))) return "review-to-viewer";
  if (operation === "incident" && lower.includes("admin")) return "review-admin-need";
  return "retain";
}

function riskMatrixEntry(name: string, value: unknown, classifier: (value: unknown) => "low" | "medium" | "high") {
  const severity = classifier(value);
  return { name, severity, evidenceChecksum: value === undefined ? undefined : sha256(value) };
}

function assuranceSeverity(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (!record) return "medium";
  if (record.decision === "blocked" || Number(record.score ?? 0) < 60) return "high";
  if (record.decision === "review" || Number(record.score ?? 100) < 80) return "medium";
  return "low";
}

function approvalSeverity(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (!record || record.status === "incomplete") return "high";
  return "low";
}

function capacitySeverity(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (record?.riskLevel === "high") return "high";
  if (record?.riskLevel === "medium") return "medium";
  return "low";
}

function sensitivitySeverity(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (record?.status === "restricted-review") return "high";
  if (record?.status === "review") return "medium";
  return "low";
}

function driftSeverity(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (record?.equal === false) return "medium";
  return "low";
}

function auditSeverity(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (record?.riskLevel === "high") return "high";
  if (record?.riskLevel === "medium") return "medium";
  return "low";
}

function exceptionSeverity(value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (record?.decision === "rejected") return "high";
  if (record?.decision === "conditional") return "medium";
  return "low";
}

function collectActions(actions: Array<{ priority: "high" | "medium" | "low"; source: string; action: string }>, source: string, value: unknown) {
  const record = value as Record<string, unknown> | undefined;
  if (!record) return;
  for (const blocker of stringArray(record.blockers)) actions.push({ priority: "high", source, action: blocker });
  for (const warning of stringArray(record.warnings)) actions.push({ priority: "medium", source, action: warning });
  for (const condition of stringArray(record.requiredConditions)) actions.push({ priority: "medium", source, action: condition });
  if (record.status === "missed" || record.status === "fail" || record.ready === false) actions.push({ priority: "high", source, action: `${source} requires remediation.` });
  if (record.reviewRequired === true || record.status === "review" || record.status === "at-risk") actions.push({ priority: "medium", source, action: `${source} requires operator review.` });
}

function priorityWeight(priority: "high" | "medium" | "low") {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortValue(entry)])
    );
  }
  return value;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
