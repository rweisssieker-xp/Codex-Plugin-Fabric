import assert from "node:assert/strict";
import test from "node:test";
import { isProductionLabel, validateMutationGuard } from "./guards.js";

test("mutation guard blocks unconfirmed mutation", () => {
  const result = validateMutationGuard({
    environmentLabel: "dev",
    expectedWorkspaceId: "11111111-1111-1111-1111-111111111111"
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /confirm: true/);
});

test("mutation guard blocks mismatched target binding", () => {
  const result = validateMutationGuard({
    confirm: true,
    environmentLabel: "test",
    expectedWorkspaceId: "11111111-1111-1111-1111-111111111111",
    actualWorkspaceId: "22222222-2222-2222-2222-222222222222"
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /expectedWorkspaceId/);
});

test("production labels require allowProduction and preflight", () => {
  assert.equal(isProductionLabel("production"), true);
  const result = validateMutationGuard({
    confirm: true,
    environmentLabel: "prod",
    expectedPipelineId: "11111111-1111-1111-1111-111111111111"
  });

  assert.equal(result.allowed, false);
  assert.match(result.blockers.join("\n"), /allowProduction/);
  assert.match(result.blockers.join("\n"), /preflight/);
});
