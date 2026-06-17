import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import process from "node:process";

test("live smoke skips without required Fabric env vars", () => {
  const env = { ...process.env };
  delete env.FABRIC_TEST_WORKSPACE_ID;
  delete env.FABRIC_TEST_ITEM_ID;
  delete env.FABRIC_TEST_PIPELINE_ID;
  delete env.FABRIC_TEST_STAGE_ID;

  const result = spawnSync(process.execPath, ["scripts/smoke-fabric-live.mjs"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"status": "skipped"/);
  assert.match(result.stdout, /"missing_required_env_vars"/);
});
