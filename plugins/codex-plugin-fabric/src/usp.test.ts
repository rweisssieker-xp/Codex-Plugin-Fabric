import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_POLICY } from "./policy.js";
import {
  buildWorkspaceFingerprint,
  calculateAssuranceScore,
  compareWorkspaceFingerprints,
  buildApprovalChainEvidence,
  buildAccessRecertificationPacket,
  buildOperatorActionQueue,
  buildReleaseRiskMatrix,
  checkChangeFreezeWindow,
  analyzeOwnershipCoverage,
  assessRollbackReadiness,
  detectAuditAnomalies,
  detectReleaseCalendarCollisions,
  diffPolicies,
  estimateBusinessImpact,
  evaluateOperationalSlo,
  evaluateReleaseReadiness,
  evaluatePolicyException,
  forecastCapacityCostRisk,
  generateComplianceEvidenceBundle,
  generateExecutiveReleaseBrief,
  generateRecoveryDrill,
  identifyDependencyBottlenecks,
  rankRootCauses,
  reviewDataContracts,
  reviewDataSensitivity,
  scoreControlMaturity,
  scoreWorkspaceCriticality,
  simulateWhatIfDeployment,
  summarizeTenantPosture,
  suggestLeastPrivilegeRoles,
  sortTimeline
} from "./usp.js";

test("assurance score blocks high-risk changes with blockers", () => {
  const result = calculateAssuranceScore({
    blockers: ["Policy blocker"],
    riskLevel: "high",
    hasCleanGit: false,
    hasApproval: false
  });

  assert.equal(result.decision, "blocked");
  assert.ok(result.score < 60);
  assert.ok(result.requiredConditions.length > 0);
});

test("policy diff identifies newly allowed and newly blocked fields", () => {
  const diff = diffPolicies(
    { ...DEFAULT_POLICY, allowGitMutations: false, allowedWorkspaceIds: [] },
    { ...DEFAULT_POLICY, allowGitMutations: true, allowedWorkspaceIds: ["11111111-1111-1111-1111-111111111111"] }
  );

  assert.ok(diff.changed.some((entry) => entry.field === "allowGitMutations"));
  assert.ok(diff.newlyAllowed.includes("allowGitMutations"));
  assert.ok(diff.newlyBlocked.includes("allowedWorkspaceIds"));
});

test("fingerprint comparison detects item and definition drift", () => {
  const left = buildWorkspaceFingerprint({
    workspaceId: "left",
    items: [{ id: "a", displayName: "Report", type: "Report", version: 1 }],
    definitions: [{ itemId: "a", definition: { parts: [{ path: "report.json", payload: "one" }] } }]
  });
  const right = buildWorkspaceFingerprint({
    workspaceId: "right",
    items: [{ id: "a", displayName: "Report", type: "Report", version: 2 }],
    definitions: [{ itemId: "a", definition: { parts: [{ path: "report.json", payload: "two" }] } }]
  });

  const drift = compareWorkspaceFingerprints(left, right);
  assert.equal(drift.equal, false);
  assert.deepEqual(drift.changedItems, ["a"]);
  assert.deepEqual(drift.definitionDrift.changed, ["a"]);
});

test("timeline sorting orders events chronologically", () => {
  const events = sortTimeline([
    { timestamp: "2026-01-02T00:00:00.000Z", source: "job", severity: "medium", message: "later" },
    { timestamp: "2026-01-01T00:00:00.000Z", source: "git", severity: "high", message: "earlier" }
  ]);

  assert.equal(events[0]?.message, "earlier");
});

test("root-cause ranking prioritizes repeated high-severity evidence", () => {
  const causes = rankRootCauses([
    { timestamp: "2026-01-01T00:00:00.000Z", source: "git", severity: "high", message: "git conflict" },
    { timestamp: "2026-01-01T00:01:00.000Z", source: "git", severity: "medium", message: "git behind" },
    { timestamp: "2026-01-01T00:02:00.000Z", source: "capacity", severity: "low", message: "capacity returned" }
  ]);

  assert.equal(causes[0]?.cause, "Git");
});

test("approval chain evidence detects missing required approvers", () => {
  const evidence = buildApprovalChainEvidence({
    approvalPacket: { approvalId: "approval-1", approvals: [{ approver: "alice" }] },
    requiredApprovers: ["alice", "bob"]
  });

  assert.equal(evidence.status, "incomplete");
  assert.deepEqual(evidence.missingApprovers, ["bob"]);
  assert.ok(evidence.checksum);
});

test("capacity cost forecast raises risk for paused capacity and broad action", () => {
  const forecast = forecastCapacityCostRisk({
    capacity: { state: "Paused" },
    plannedActions: [{ itemCount: 75, estimatedDurationMinutes: 180 }]
  });

  assert.equal(forecast.riskLevel, "high");
  assert.ok(forecast.signals.some((signal) => signal.severity === "high"));
});

test("sensitivity review finds credential and regulated data indicators", () => {
  const review = reviewDataSensitivity({
    items: [{ id: "item-1", displayName: "Patient API Token Model" }],
    definitions: [{ itemId: "item-1", definition: { parts: [{ payload: "customer email" }] } }]
  });

  assert.equal(review.status, "restricted-review");
  assert.ok(review.findings.some((finding) => finding.category === "credential"));
  assert.ok(review.findings.some((finding) => finding.category === "regulated-health"));
});

test("release readiness gate blocks incomplete approval and high capacity risk", () => {
  const gate = evaluateReleaseReadiness({
    assuranceScore: { score: 92, decision: "ready" },
    approvalEvidence: { status: "incomplete" },
    capacityRisk: { riskLevel: "high" },
    sensitivityReview: { status: "clear" }
  });

  assert.equal(gate.decision, "no-go");
  assert.ok(gate.blockers.length >= 2);
});

test("compliance evidence bundle tracks missing sections and checksums", () => {
  const bundle = generateComplianceEvidenceBundle({
    subject: { workspaceId: "workspace-1" },
    changeAssurance: { score: 95 },
    approvalEvidence: { status: "complete" }
  });

  assert.ok(bundle.checksum);
  assert.ok(bundle.completeness < 100);
  assert.ok(bundle.missingSections.includes("policySimulation"));
});

test("audit anomaly detection flags production and blocked audit entries", () => {
  const result = detectAuditAnomalies([
    { timestamp: "2026-01-01T00:00:00.000Z", tool: "fabric_deploy_stage_content", status: "blocked" },
    { timestamp: "2026-01-01T00:01:00.000Z", tool: "fabric_deploy_stage_content", environmentLabel: "production", confirm: true }
  ]);

  assert.equal(result.riskLevel, "high");
  assert.ok(result.anomalies.some((entry) => entry.category === "production-mutation"));
});

test("least privilege suggestions flag admin for read operations", () => {
  const result = suggestLeastPrivilegeRoles({
    operation: "read",
    roleAssignments: { value: [{ principalId: "user-1", role: "Admin" }] }
  });

  assert.equal(result.assignmentCount, 1);
  assert.equal(result.suggestions[0]?.recommendation, "review-to-viewer");
});

test("policy exception evaluation rejects missing expiry", () => {
  const result = evaluatePolicyException({
    reason: "Temporary beta validation",
    compensatingControls: ["Non-prod only"],
    scope: { workspaceId: "workspace-1" }
  });

  assert.equal(result.decision, "rejected");
  assert.ok(result.blockers.some((blocker) => blocker.includes("expiry")));
});

test("release risk matrix ranks high-risk evidence", () => {
  const matrix = buildReleaseRiskMatrix({
    assuranceScore: { score: 40, decision: "blocked" },
    approvalEvidence: { status: "incomplete" },
    capacityRisk: { riskLevel: "high" }
  });

  assert.equal(matrix.level, "high");
  assert.ok(matrix.topRisks.length >= 3);
});

test("what-if deployment simulation blocks policy blockers", () => {
  const simulation = simulateWhatIfDeployment({
    itemCount: 3,
    policyEvaluation: { blockers: ["Workspace not allowlisted"] }
  });

  assert.equal(simulation.predictedOutcome, "blocked");
  assert.ok(simulation.blockers.length > 0);
});

test("rollback readiness requires exported definitions", () => {
  const readiness = assessRollbackReadiness({ gitStatus: { status: "Clean" }, definitions: [] });

  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockers.some((blocker) => blocker.includes("definitions")));
});

test("ownership coverage flags orphaned items without role coverage", () => {
  const coverage = analyzeOwnershipCoverage({ items: [{ id: "a", displayName: "Report", type: "Report" }], roleAssignments: [] });

  assert.equal(coverage.coverage, 0);
  assert.equal(coverage.orphanedItems.length, 1);
});

test("data contract review fails missing required terms", () => {
  const review = reviewDataContracts({
    definitions: [{ itemId: "a", definition: { name: "model only" } }],
    requiredTerms: ["schema", "version"]
  });

  assert.equal(review.status, "review");
  assert.deepEqual(review.reviews[0]?.missingTerms, ["schema", "version"]);
});

test("tenant posture weakens on paused capacity evidence", () => {
  const posture = summarizeTenantPosture({
    workspaces: { value: [{ id: "w" }] },
    capacities: { value: [{ id: "c", state: "Paused" }] },
    policy: { allowAdminPreview: false, allowBetaApis: false }
  });

  assert.equal(posture.posture, "weak");
});

test("operational slo misses with failed and blocked evidence", () => {
  const slo = evaluateOperationalSlo({
    jobs: [{ status: "Failed" }, { status: "Blocked" }, { status: "Succeeded" }],
    targetSuccessRate: 95
  });

  assert.equal(slo.status, "missed");
  assert.equal(slo.successRate, 33);
});

test("workspace criticality scores tier one for broad production warehouse evidence", () => {
  const criticality = scoreWorkspaceCriticality({
    items: Array.from({ length: 55 }, (_, index) => ({ id: String(index), type: index === 0 ? "Warehouse" : "Report" })),
    roleAssignments: [{ role: "Admin" }],
    audit: [{ environmentLabel: "production" }],
    capacityRisk: { riskLevel: "high" }
  });

  assert.equal(criticality.tier, "tier-1");
  assert.ok(criticality.score >= 70);
});

test("change freeze window blocks matching environment", () => {
  const freeze = checkChangeFreezeWindow({
    environmentLabel: "prod",
    now: "2026-01-01T12:00:00.000Z",
    freezeWindows: [{ start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z", environmentLabels: ["prod"] }]
  });

  assert.equal(freeze.frozen, true);
  assert.equal(freeze.decision, "blocked-by-freeze");
});

test("access recertification packet requires review for privileged assignments", () => {
  const packet = buildAccessRecertificationPacket({
    workspaceId: "workspace-1",
    roleAssignments: { value: [{ principalId: "user-1", role: "Admin" }] }
  });

  assert.equal(packet.reviewRequired, true);
  assert.equal(packet.privilegedCount, 1);
  assert.ok(packet.checksum);
});

test("executive release brief summarizes decision and risks", () => {
  const brief = generateExecutiveReleaseBrief({
    releaseGate: { decision: "conditional-go", warnings: ["Drift present"] },
    riskMatrix: { level: "medium" },
    criticality: { tier: "tier-2" },
    operationalSlo: { status: "met" }
  });

  assert.equal(brief.decision, "conditional-go");
  assert.match(brief.summary, /Risk level: medium/);
});

test("operator action queue prioritizes blockers", () => {
  const queue = buildOperatorActionQueue({
    releaseGate: { blockers: ["Approval missing"], warnings: ["Drift present"] },
    operationalSlo: { status: "missed" }
  });

  assert.equal(queue.actions[0]?.priority, "high");
  assert.ok(queue.actionCount >= 3);
});

test("business impact estimates material impact from usage and criticality", () => {
  const impact = estimateBusinessImpact({
    items: Array.from({ length: 10 }, (_, index) => ({ id: String(index) })),
    criticality: { score: 80 },
    affectedUsers: 400,
    revenueAtRisk: 250000
  });

  assert.equal(impact.level, "material");
  assert.ok(impact.score >= 70);
});

test("dependency bottleneck detection finds high fan-out node", () => {
  const result = identifyDependencyBottlenecks({
    graph: {
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "a", to: "d" }]
    }
  });

  assert.equal(result.bottlenecks[0]?.id, "a");
});

test("release calendar collision detects overlapping windows", () => {
  const result = detectReleaseCalendarCollisions({
    proposedStart: "2026-01-01T10:00:00.000Z",
    proposedEnd: "2026-01-01T12:00:00.000Z",
    existingReleases: [{ name: "Finance", start: "2026-01-01T11:00:00.000Z", end: "2026-01-01T13:00:00.000Z" }]
  });

  assert.equal(result.decision, "reschedule-or-approve-exception");
  assert.equal(result.collisionCount, 1);
});

test("recovery drill blocks when rollback and incident evidence are missing", () => {
  const drill = generateRecoveryDrill({ rollbackReadiness: { ready: false } });

  assert.equal(drill.readyForDrill, false);
  assert.ok(drill.blockers.length >= 2);
});

test("control maturity scores optimized when all controls are present", () => {
  const maturity = scoreControlMaturity({
    changeAssurance: {},
    policySimulation: {},
    environmentDrift: {},
    approvalEvidence: {},
    releaseGate: {},
    complianceBundle: {},
    rollbackReadiness: {},
    operationalSlo: {}
  });

  assert.equal(maturity.level, "optimized");
  assert.equal(maturity.score, 100);
});
