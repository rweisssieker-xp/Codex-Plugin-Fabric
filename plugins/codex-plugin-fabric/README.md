# Codex Plugin Fabric

Local Codex MCP plugin for Microsoft Fabric control. It exposes safe operator tools for inventory, deployment pipelines, Git integration, connections, gateways, capacities, job runs, diagnostics, definition diffing, local audit logging, and intelligence such as dependency graphs and blast-radius analysis.

## Install

```powershell
npm install
npm run build
```

## Auth

Default auth uses Microsoft Entra device code flow through MSAL:

```powershell
$env:FABRIC_AUTH_MODE = "device_code"
$env:FABRIC_TENANT_ID = "common"
$env:FABRIC_CLIENT_ID = "<public-client-app-id>"
npm start
```

Service principal auth is optional and only works when the Fabric tenant setting and the specific Fabric API support service principals:

```powershell
$env:FABRIC_AUTH_MODE = "service_principal"
$env:FABRIC_TENANT_ID = "<tenant-id>"
$env:FABRIC_CLIENT_ID = "<app-id>"
$env:FABRIC_CLIENT_SECRET = "<secret>"
```

Secrets are read only from environment variables. They are never written to source files, audit logs, or state files.

## MCP Tools

The plugin also bundles the `fabric-operator` skill, which guides Codex through inventory-first Fabric operations, deployment preflight, guarded execution, diagnostics, and audit review.

Inventory:

- `fabric_list_workspaces`
- `fabric_get_workspace`
- `fabric_list_items`
- `fabric_get_item`
- `fabric_workspace_snapshot`
- `fabric_workspace_health_score`
- `fabric_list_workspace_role_assignments`
- `fabric_get_workspace_role_assignment`

Deployment:

- `fabric_list_deployment_pipelines`
- `fabric_get_deployment_pipeline`
- `fabric_list_deployment_stages`
- `fabric_list_stage_items`
- `fabric_deployment_preflight`
- `fabric_deploy_stage_content`
- `fabric_get_operation_state`
- `fabric_get_operation_result`

Jobs and diagnostics:

- `fabric_run_item_job`
- `fabric_get_job_instance`
- `fabric_list_recent_job_instances`
- `fabric_diagnose_failed_run`

Intelligence and local governance:

- `fabric_get_item_definition`
- `fabric_compare_item_definitions`
- `fabric_generate_deployment_review`
- `fabric_bulk_export_item_definitions`
- `fabric_generate_pull_request_summary`
- `fabric_package_workspace_definitions`
- `fabric_update_item_definition`
- `fabric_build_dependency_graph`
- `fabric_analyze_blast_radius`
- `fabric_generate_runbook`
- `fabric_classify_risk`
- `fabric_get_audit_log`
- `fabric_get_policy`
- `fabric_remember_environment`
- `fabric_list_known_environments`

Git integration:

- `fabric_git_get_connection`
- `fabric_git_get_status`
- `fabric_git_connect`
- `fabric_git_disconnect`
- `fabric_git_commit`
- `fabric_git_update_from_git`
- `fabric_git_initialize_connection`
- `fabric_git_get_my_credentials`
- `fabric_git_readiness`
- `fabric_git_update_my_credentials`

Connections, gateways, admin, and capacity:

- `fabric_list_connections`
- `fabric_get_connection`
- `fabric_list_gateways`
- `fabric_get_gateway`
- `fabric_list_item_connections`
- `fabric_list_supported_connection_types`
- `fabric_list_connection_role_assignments`
- `fabric_test_connection`
- `fabric_check_connection_policy`
- `fabric_admin_list_items`
- `fabric_admin_get_item`
- `fabric_list_capacities`
- `fabric_get_capacity`
- `fabric_diagnose_workspace_incident`
- `fabric_list_deployment_pipeline_operations`
- `fabric_get_deployment_pipeline_operation`

Innovation layer:

- `fabric_control_room_snapshot`
- `fabric_build_lineage_map`
- `fabric_render_control_room_html`
- `fabric_generate_change_cards`
- `fabric_create_approval_packet`
- `fabric_analyze_permissions`
- `fabric_analyze_capacity_risk`
- `fabric_correlate_incident`
- `fabric_generate_recovery_plan`
- `fabric_export_as_code_package`
- `fabric_validate_live_mutation_readiness`

Enterprise USP layer:

- `fabric_change_assurance_report`
- `fabric_change_assurance_score`
- `fabric_change_assurance_html`
- `fabric_simulate_policy_on_workspace`
- `fabric_suggest_policy_tightening`
- `fabric_policy_diff`
- `fabric_fingerprint_workspace`
- `fabric_compare_environment_fingerprints`
- `fabric_drift_review_cards`
- `fabric_build_incident_timeline`
- `fabric_rank_root_causes`
- `fabric_incident_brief`
- `fabric_generate_deploy_playbook`
- `fabric_validate_playbook_step`
- `fabric_finalize_mutation_evidence`
- `fabric_build_approval_chain_evidence`
- `fabric_forecast_capacity_cost_risk`
- `fabric_map_workspace_blast_radius`
- `fabric_review_data_sensitivity`
- `fabric_release_readiness_gate`
- `fabric_generate_compliance_evidence_bundle`
- `fabric_detect_audit_anomalies`
- `fabric_suggest_least_privilege_roles`
- `fabric_evaluate_policy_exception`
- `fabric_build_release_risk_matrix`
- `fabric_simulate_what_if_deployment`
- `fabric_assess_rollback_readiness`
- `fabric_analyze_ownership_coverage`
- `fabric_review_data_contracts`
- `fabric_summarize_tenant_posture`
- `fabric_evaluate_operational_slo`
- `fabric_score_workspace_criticality`
- `fabric_check_change_freeze_window`
- `fabric_build_access_recertification_packet`
- `fabric_generate_executive_release_brief`
- `fabric_build_operator_action_queue`
- `fabric_estimate_business_impact`
- `fabric_identify_dependency_bottlenecks`
- `fabric_detect_release_calendar_collisions`
- `fabric_generate_recovery_drill`
- `fabric_score_control_maturity`

Workflow recipes and specialized skills:

- `fabric_list_workflow_recipes`
- `fabric_get_workflow_recipe`
- `fabric_generate_workflow_prompt`
- bundled skills: `fabric-change-assurance`, `fabric-policy-governor`, `fabric-environment-drift`, `fabric-incident-commander`, `fabric-release-manager`, `fabric-governance-board`, `fabric-compliance-officer`, `fabric-resilience-architect`, `fabric-executive-control`, `fabric-value-and-maturity`

## Guardrails

Read-only tools run directly. Mutating tools require `confirm: true`, an `environmentLabel`, and an expected target ID. Production-like labels additionally require `allowProduction: true`. V1 intentionally does not expose delete operations, workspace creation, or automatic repair.

## Examples

- "List all Fabric workspaces I can access."
- "Create a snapshot of workspace `<id>` and flag risky deployment context."
- "Preflight deployment pipeline `<id>` stage `<stage-id>` to production."
- "Deploy selected stage items only after preflight and confirmation."
- "Diagnose failed Fabric job instance `<run-id>`."

## Test

```powershell
npm test
npm run smoke
npm run verify:marketplace
npm run verify:endpoints
npm run verify:all
npm run export:tool-metadata
npm run evidence:package
```
