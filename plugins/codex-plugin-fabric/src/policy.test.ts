import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_POLICY, evaluatePolicy, isPolicyProductionLabel } from "./policy.js";

test("policy blocks non-allowlisted workspace", () => {
  const policy = {
    ...DEFAULT_POLICY,
    allowedWorkspaceIds: ["11111111-1111-1111-1111-111111111111"]
  };

  const result = evaluatePolicy(policy, {
    action: "runItemJob",
    environmentLabel: "dev",
    expectedWorkspaceId: "22222222-2222-2222-2222-222222222222",
    actualWorkspaceId: "22222222-2222-2222-2222-222222222222"
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /allowedWorkspaceIds/);
});

test("policy blocks oversized deployments", () => {
  const result = evaluatePolicy(DEFAULT_POLICY, {
    action: "deploy",
    environmentLabel: "test",
    expectedPipelineId: "11111111-1111-1111-1111-111111111111",
    actualPipelineId: "11111111-1111-1111-1111-111111111111",
    itemCount: DEFAULT_POLICY.maxDeploymentItems + 1
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /maxDeploymentItems/);
});

test("policy recognizes production aliases", () => {
  assert.equal(isPolicyProductionLabel(DEFAULT_POLICY, "prd"), true);
  assert.equal(isPolicyProductionLabel(DEFAULT_POLICY, "sandbox"), false);
});

test("policy blocks git mutations by default", () => {
  const result = evaluatePolicy(DEFAULT_POLICY, {
    action: "gitMutation",
    environmentLabel: "dev",
    expectedWorkspaceId: "11111111-1111-1111-1111-111111111111",
    actualWorkspaceId: "11111111-1111-1111-1111-111111111111"
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /Git mutations/);
});

test("policy blocks admin preview without explicit policy flag", () => {
  const result = evaluatePolicy(DEFAULT_POLICY, {
    action: "adminPreview",
    isAdminPreview: true,
    expectedWorkspaceId: "admin-preview"
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /allowAdminPreview/);
});

test("policy blocks disallowed connection and gateway ids", () => {
  const policy = {
    ...DEFAULT_POLICY,
    allowedConnectionIds: ["11111111-1111-1111-1111-111111111111"],
    allowedGatewayIds: ["22222222-2222-2222-2222-222222222222"]
  };
  const result = evaluatePolicy(policy, {
    action: "connectionCheck",
    expectedWorkspaceId: "33333333-3333-3333-3333-333333333333",
    connectionIds: ["44444444-4444-4444-4444-444444444444"],
    gatewayIds: ["55555555-5555-5555-5555-555555555555"]
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /Connection ID/);
  assert.match(result.blockers.join("\n"), /Gateway ID/);
});

test("policy blocks beta APIs and definition apply by default", () => {
  const beta = evaluatePolicy(DEFAULT_POLICY, {
    action: "bulkExportDefinitions",
    expectedWorkspaceId: "11111111-1111-1111-1111-111111111111",
    isBetaApi: true
  });
  const apply = evaluatePolicy(DEFAULT_POLICY, {
    action: "updateItemDefinition",
    expectedWorkspaceId: "11111111-1111-1111-1111-111111111111",
    expectedItemId: "22222222-2222-2222-2222-222222222222",
    actualItemId: "22222222-2222-2222-2222-222222222222",
    isDefinitionApply: true
  });

  assert.equal(beta.allowed, false);
  assert.match(beta.blockers.join("\n"), /allowBetaApis/);
  assert.equal(apply.allowed, false);
  assert.match(apply.blockers.join("\n"), /allowDefinitionApply/);
});

test("policy enables local learning with bounded payload defaults", () => {
  assert.equal(DEFAULT_POLICY.allowLocalLearning, true);
  assert.equal(DEFAULT_POLICY.allowTaskMemory, true);
  assert.equal(DEFAULT_POLICY.allowAutomaticTaskSummaryMemory, true);
  assert.equal(DEFAULT_POLICY.allowLearningEvidenceExport, true);
  assert.equal(DEFAULT_POLICY.maxLearningPayloadBytes, 65536);
  assert.equal(DEFAULT_POLICY.maxTaskMemoryPayloadBytes, 65536);
  assert.equal(DEFAULT_POLICY.minLessonConfidenceForPolicySuggestions, 0.5);
});
