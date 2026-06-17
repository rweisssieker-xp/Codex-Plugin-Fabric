import assert from "node:assert/strict";
import test from "node:test";
import { FABRIC_ENDPOINTS, validateEndpointRegistry } from "./fabricEndpoints.js";

test("endpoint registry has no invalid destructive or unguarded mutating endpoints", () => {
  assert.deepEqual(validateEndpointRegistry(), []);
  assert.equal(FABRIC_ENDPOINTS.some((endpoint) => endpoint.method === "DELETE"), false);
});

test("endpoint registry marks definition apply as guarded mutating", () => {
  const endpoint = FABRIC_ENDPOINTS.find((entry) => entry.tool === "fabric_update_item_definition");
  assert.ok(endpoint);
  assert.equal(endpoint.mutating, true);
  assert.equal(endpoint.requiresGuardrails, true);
});

test("endpoint registry includes innovation tools as non-mutating local tools", () => {
  const innovationTools = [
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
    "fabric_validate_live_mutation_readiness"
  ];

  for (const tool of innovationTools) {
    const endpoint = FABRIC_ENDPOINTS.find((entry) => entry.tool === tool);
    assert.ok(endpoint, `Missing endpoint metadata for ${tool}`);
    assert.equal(endpoint.group, "innovation");
    assert.equal(endpoint.mutating, false);
  }
});

test("endpoint registry includes enterprise USP tool groups as non-mutating local tools", () => {
  const expected = new Map([
    ["fabric_change_assurance_report", "change_assurance"],
    ["fabric_change_assurance_score", "change_assurance"],
    ["fabric_change_assurance_html", "change_assurance"],
    ["fabric_simulate_policy_on_workspace", "policy_simulation"],
    ["fabric_suggest_policy_tightening", "policy_simulation"],
    ["fabric_policy_diff", "policy_simulation"],
    ["fabric_fingerprint_workspace", "environment_drift"],
    ["fabric_compare_environment_fingerprints", "environment_drift"],
    ["fabric_drift_review_cards", "environment_drift"],
    ["fabric_build_incident_timeline", "incident_intelligence"],
    ["fabric_rank_root_causes", "incident_intelligence"],
    ["fabric_incident_brief", "incident_intelligence"],
    ["fabric_generate_deploy_playbook", "playbook"],
    ["fabric_validate_playbook_step", "playbook"],
    ["fabric_finalize_mutation_evidence", "playbook"]
  ]);

  for (const [tool, group] of expected) {
    const endpoint = FABRIC_ENDPOINTS.find((entry) => entry.tool === tool);
    assert.ok(endpoint, `Missing endpoint metadata for ${tool}`);
    assert.equal(endpoint.group, group);
    assert.equal(endpoint.mutating, false);
  }
});

test("endpoint registry includes workflow recipe tools", () => {
  for (const tool of ["fabric_list_workflow_recipes", "fabric_get_workflow_recipe", "fabric_generate_workflow_prompt"]) {
    const endpoint = FABRIC_ENDPOINTS.find((entry) => entry.tool === tool);
    assert.ok(endpoint, `Missing endpoint metadata for ${tool}`);
    assert.equal(endpoint.group, "workflows");
    assert.equal(endpoint.mutating, false);
  }
});

test("endpoint registry includes advanced USP tools", () => {
  for (const tool of [
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
    "fabric_score_control_maturity"
  ]) {
    const endpoint = FABRIC_ENDPOINTS.find((entry) => entry.tool === tool);
    assert.ok(endpoint, `Missing endpoint metadata for ${tool}`);
    assert.equal(endpoint.group, "advanced_usps");
    assert.equal(endpoint.mutating, false);
  }
});

test("endpoint registry includes learning tools as local advisory tools", () => {
  for (const tool of [
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
  ]) {
    const endpoint = FABRIC_ENDPOINTS.find((entry) => entry.tool === tool);
    assert.ok(endpoint, `Missing endpoint metadata for ${tool}`);
    assert.equal(endpoint.group, "learning");
    assert.equal(endpoint.path.startsWith("local://"), true);
    assert.equal(endpoint.mutating, false);
  }
});
