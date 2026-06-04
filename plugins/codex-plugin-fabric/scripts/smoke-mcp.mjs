import { spawn } from "node:child_process";
import process from "node:process";

const expectedTools = [
  "fabric_list_workspaces",
  "fabric_list_items",
  "fabric_get_item",
  "fabric_workspace_snapshot",
  "fabric_list_deployment_pipelines",
  "fabric_get_deployment_pipeline",
  "fabric_list_deployment_stages",
  "fabric_list_stage_items",
  "fabric_deployment_preflight",
  "fabric_deploy_stage_content",
  "fabric_get_operation_state",
  "fabric_get_operation_result",
  "fabric_run_item_job",
  "fabric_get_job_instance",
  "fabric_list_recent_job_instances",
  "fabric_diagnose_failed_run",
  "fabric_get_item_definition",
  "fabric_build_dependency_graph",
  "fabric_analyze_blast_radius",
  "fabric_generate_runbook",
  "fabric_classify_risk",
  "fabric_get_policy",
  "fabric_get_audit_log",
  "fabric_remember_environment",
  "fabric_list_known_environments"
];

const child = spawn(process.execPath, ["dist/server.js"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    FABRIC_AUTH_MODE: "device_code",
    FABRIC_CLIENT_ID: "00000000-0000-0000-0000-000000000000"
  }
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString("utf8");
});
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString("utf8");
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "fabric-control-smoke", version: "0.1.0" }
  }
});
send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

const timeout = setTimeout(() => {
  child.kill();
  console.error("MCP smoke test timed out.");
  console.error(stderr);
  process.exit(1);
}, 5000);

const interval = setInterval(() => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const responses = lines.flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const toolsResponse = responses.find((response) => response.id === 2);
  if (!toolsResponse) return;

  clearTimeout(timeout);
  clearInterval(interval);
  child.kill();

  const tools = toolsResponse.result?.tools ?? [];
  const names = tools.map((tool) => tool.name);
  const missing = expectedTools.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    console.error(`Missing MCP tools: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`MCP smoke passed: ${names.length} tools registered.`);
}, 50);

