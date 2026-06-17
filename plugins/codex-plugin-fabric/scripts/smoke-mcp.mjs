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
  "fabric_list_known_environments",
  "fabric_git_get_connection",
  "fabric_git_connect",
  "fabric_git_disconnect",
  "fabric_git_get_status",
  "fabric_git_commit",
  "fabric_git_update_from_git",
  "fabric_git_initialize_connection",
  "fabric_list_connections",
  "fabric_get_connection",
  "fabric_list_gateways",
  "fabric_get_gateway",
  "fabric_list_item_connections",
  "fabric_check_connection_policy",
  "fabric_compare_item_definitions",
  "fabric_generate_deployment_review",
  "fabric_admin_list_items",
  "fabric_admin_get_item",
  "fabric_admin_list_workspaces",
  "fabric_admin_list_item_access_details",
  "fabric_admin_list_workspace_access_details",
  "fabric_admin_list_user_access_entities",
  "fabric_list_capacities",
  "fabric_get_capacity",
  "fabric_get_workspace",
  "fabric_workspace_health_score",
  "fabric_diagnose_workspace_incident",
  "fabric_list_workspace_role_assignments",
  "fabric_get_workspace_role_assignment",
  "fabric_git_get_my_credentials",
  "fabric_git_readiness",
  "fabric_git_update_my_credentials",
  "fabric_list_supported_connection_types",
  "fabric_list_connection_role_assignments",
  "fabric_test_connection",
  "fabric_list_deployment_pipeline_operations",
  "fabric_get_deployment_pipeline_operation",
  "fabric_bulk_export_item_definitions",
  "fabric_generate_pull_request_summary",
  "fabric_package_workspace_definitions",
  "fabric_update_item_definition",
  "fabric_control_room_snapshot",
  "fabric_build_lineage_map",
  "fabric_render_control_room_html",
  "fabric_generate_change_cards",
  "fabric_create_approval_packet",
  "fabric_analyze_permissions",
  "fabric_analyze_capacity_risk",
  "fabric_correlate_incident",
  "fabric_generate_recovery_plan",
  "fabric_export_as_code_package",
  "fabric_validate_live_mutation_readiness",
  "fabric_change_assurance_report",
  "fabric_change_assurance_score",
  "fabric_change_assurance_html",
  "fabric_simulate_policy_on_workspace",
  "fabric_suggest_policy_tightening",
  "fabric_policy_diff",
  "fabric_fingerprint_workspace",
  "fabric_compare_environment_fingerprints",
  "fabric_drift_review_cards",
  "fabric_build_incident_timeline",
  "fabric_rank_root_causes",
  "fabric_incident_brief",
  "fabric_generate_deploy_playbook",
  "fabric_validate_playbook_step",
  "fabric_finalize_mutation_evidence",
  "fabric_build_approval_chain_evidence",
  "fabric_forecast_capacity_cost_risk",
  "fabric_map_workspace_blast_radius",
  "fabric_review_data_sensitivity",
  "fabric_release_readiness_gate",
  "fabric_generate_compliance_evidence_bundle",
  "fabric_detect_audit_anomalies",
  "fabric_suggest_least_privilege_roles",
  "fabric_evaluate_policy_exception",
  "fabric_build_release_risk_matrix",
  "fabric_simulate_what_if_deployment",
  "fabric_assess_rollback_readiness",
  "fabric_analyze_ownership_coverage",
  "fabric_review_data_contracts",
  "fabric_summarize_tenant_posture",
  "fabric_evaluate_operational_slo",
  "fabric_score_workspace_criticality",
  "fabric_check_change_freeze_window",
  "fabric_build_access_recertification_packet",
  "fabric_generate_executive_release_brief",
  "fabric_build_operator_action_queue",
  "fabric_estimate_business_impact",
  "fabric_identify_dependency_bottlenecks",
  "fabric_detect_release_calendar_collisions",
  "fabric_generate_recovery_drill",
  "fabric_score_control_maturity",
  "fabric_list_workflow_recipes",
  "fabric_get_workflow_recipe",
  "fabric_generate_workflow_prompt",
  "fabric_get_learning_status",
  "fabric_record_learning_event",
  "fabric_record_task_memory",
  "fabric_find_similar_task_memories",
  "fabric_recommend_next_task_steps",
  "fabric_record_operator_feedback",
  "fabric_list_learned_lessons",
  "fabric_analyze_learning_patterns",
  "fabric_generate_learned_playbook",
  "fabric_suggest_policy_improvements",
  "fabric_export_learning_evidence"
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
