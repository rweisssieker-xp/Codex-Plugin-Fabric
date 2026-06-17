import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const smoke = fs.readFileSync(path.join(root, "scripts", "smoke-mcp.mjs"), "utf8");
const endpointSource = fs.readFileSync(path.join(root, "src", "fabricEndpoints.ts"), "utf8");
const smokeTools = [...smoke.matchAll(/"fabric_[a-z0-9_]+"/g)].map((match) => match[0].slice(1, -1));
const registryTools = [...endpointSource.matchAll(/tool:\s*"([^"]+)"/g)].map((match) => match[1]);
const deletePaths = [...endpointSource.matchAll(/method:\s*"DELETE"/g)];
const missingCritical = [
  "fabric_deploy_stage_content",
  "fabric_run_item_job",
  "fabric_git_connect",
  "fabric_git_commit",
  "fabric_update_item_definition",
  "fabric_admin_list_items",
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
  "fabric_generate_workflow_prompt"
].filter((tool) => !registryTools.includes(tool));

if (deletePaths.length > 0) {
  console.error("Endpoint registry contains DELETE metadata.");
  process.exit(1);
}
if (missingCritical.length > 0) {
  console.error(`Endpoint registry is missing critical tools: ${missingCritical.join(", ")}`);
  process.exit(1);
}
const unregisteredSmokeTools = smokeTools.filter((tool) =>
  /deploy|run_item_job|git_|admin_|bulk_export|update_item_definition/.test(tool) && !registryTools.includes(tool)
);
if (unregisteredSmokeTools.length > 0) {
  console.error(`Endpoint registry missing smoke tool metadata: ${unregisteredSmokeTools.join(", ")}`);
  process.exit(1);
}

console.log(`Endpoint verification passed: ${registryTools.length} endpoint metadata entries, ${smokeTools.length} smoke tools.`);
