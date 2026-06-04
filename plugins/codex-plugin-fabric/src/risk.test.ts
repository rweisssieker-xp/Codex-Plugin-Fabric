import assert from "node:assert/strict";
import test from "node:test";
import { classifyRisk } from "./risk.js";

test("risk classifier marks production deploy without target binding high", () => {
  const result = classifyRisk({
    action: "deploy",
    environmentLabel: "prod",
    itemCount: 15,
    hasExpectedTarget: false,
    hasPreflight: false
  });

  assert.equal(result.level, "high");
  assert.ok(result.blockers.includes("Expected target binding is missing."));
});

test("risk classifier keeps read-like dev action low", () => {
  const result = classifyRisk({
    action: "snapshot",
    environmentLabel: "dev",
    hasExpectedTarget: true,
    hasPreflight: true
  });

  assert.equal(result.level, "low");
});
