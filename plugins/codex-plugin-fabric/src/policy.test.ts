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
