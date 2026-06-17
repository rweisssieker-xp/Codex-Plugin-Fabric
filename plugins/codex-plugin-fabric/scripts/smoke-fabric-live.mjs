import { FabricClient } from "../dist/fabricClient.js";
import { loadConfig } from "../dist/config.js";
import { MsalTokenProvider } from "../dist/auth.js";

const required = ["FABRIC_TEST_WORKSPACE_ID", "FABRIC_TEST_ITEM_ID", "FABRIC_TEST_PIPELINE_ID", "FABRIC_TEST_STAGE_ID"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.log(JSON.stringify({
    liveSmoke: {
      status: "skipped",
      reason: "missing_required_env_vars",
      missing
    }
  }, null, 2));
  process.exit(0);
}

const config = loadConfig();
const client = new FabricClient(config, new MsalTokenProvider(config));
const workspaceId = process.env.FABRIC_TEST_WORKSPACE_ID;
const itemId = process.env.FABRIC_TEST_ITEM_ID;
const pipelineId = process.env.FABRIC_TEST_PIPELINE_ID;
const stageId = process.env.FABRIC_TEST_STAGE_ID;
const connectionId = process.env.FABRIC_TEST_CONNECTION_ID;

const checks = [
  ["list workspaces", () => client.request("/workspaces")],
  ["get workspace", () => client.request(`/workspaces/${workspaceId}`)],
  ["list items", () => client.request(`/workspaces/${workspaceId}/items`)],
  ["get item", () => client.request(`/workspaces/${workspaceId}/items/${itemId}`)],
  ["get item definition", () => client.request(`/workspaces/${workspaceId}/items/${itemId}/getDefinition`, { method: "POST" }).then((r) => client.resolveOperationIfPresent(r))],
  ["git status", () => client.request(`/workspaces/${workspaceId}/git/status`).then((r) => client.resolveOperationIfPresent(r))],
  ["list connections", () => client.request("/connections")],
  ["list gateways", () => client.request("/gateways")],
  ["list capacities", () => client.request("/capacities")],
  ["list deployment stages", () => client.request(`/deploymentPipelines/${pipelineId}/stages`)],
  ["list stage items", () => client.request(`/deploymentPipelines/${pipelineId}/stages/${stageId}/items`)]
];
if (connectionId) checks.push(["get connection", () => client.request(`/connections/${connectionId}`)]);

const results = [];
for (const [name, check] of checks) {
  try {
    const response = await check();
    results.push({ name, ok: true, status: response.status, requestId: response.requestId });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

console.log(JSON.stringify({ liveSmoke: results }, null, 2));
if (results.some((result) => !result.ok)) process.exit(1);
