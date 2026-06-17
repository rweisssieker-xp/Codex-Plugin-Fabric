---
name: fabric-operator
description: Use Microsoft Fabric Control to inspect workspaces, preflight deployments, run Fabric jobs, diagnose failures, and enforce production guardrails.
---

# Microsoft Fabric Operator

Use this skill when the user asks Codex to operate, inspect, deploy, diagnose, or govern Microsoft Fabric.

## Operating Rules

- Prefer read-only inspection before any mutating action.
- Use exact Fabric IDs when available: workspace ID, item ID, deployment pipeline ID, stage ID, operation ID, and job instance ID.
- For mutating tools, require target binding through `expectedWorkspaceId` or `expectedPipelineId`.
- For production-like targets, require `confirm: true`, `allowProduction: true`, `preflightPassed: true`, and an explicit `environmentLabel`.
- Do not use this plugin for deletes, workspace creation, destructive rollback, or automatic repair in V1.
- Dependency graph and blast-radius tools use observed item-definition references from Fabric APIs only.

## Preferred Workflow

1. Inventory: use `fabric_list_workspaces`, `fabric_list_items`, or `fabric_workspace_snapshot`.
2. Environment context: use `fabric_list_known_environments` and `fabric_get_policy`.
3. Deployment readiness: use `fabric_list_deployment_pipelines`, `fabric_list_deployment_stages`, `fabric_list_stage_items`, then `fabric_deployment_preflight`.
4. Fabric-as-Code readiness: use `fabric_git_get_status`, `fabric_get_item_definition`, `fabric_compare_item_definitions`, and `fabric_generate_deployment_review`.
5. Fabric-as-Code packaging: use `fabric_bulk_export_item_definitions`, `fabric_package_workspace_definitions`, and `fabric_generate_pull_request_summary`.
6. Execution: use `fabric_deploy_stage_content`, `fabric_run_item_job`, guarded `fabric_git_*` mutation tools, or `fabric_update_item_definition` only after guardrail requirements are satisfied.
7. Monitoring: use `fabric_get_operation_state`, `fabric_get_operation_result`, `fabric_get_job_instance`, or `fabric_list_recent_job_instances`.
8. Control room: use `fabric_control_room_snapshot`, `fabric_build_lineage_map`, and `fabric_render_control_room_html`.
9. Review and approval: use `fabric_generate_change_cards`, `fabric_create_approval_packet`, and `fabric_validate_live_mutation_readiness`.
10. Change assurance: use `fabric_change_assurance_report`, `fabric_change_assurance_score`, and `fabric_change_assurance_html` before high-impact deployments.
11. Policy and drift: use `fabric_simulate_policy_on_workspace`, `fabric_suggest_policy_tightening`, `fabric_policy_diff`, `fabric_fingerprint_workspace`, and `fabric_compare_environment_fingerprints`.
12. Diagnostics: use `fabric_diagnose_failed_run`, `fabric_correlate_incident`, `fabric_build_incident_timeline`, `fabric_rank_root_causes`, `fabric_incident_brief`, `fabric_analyze_capacity_risk`, `fabric_analyze_permissions`, and `fabric_generate_recovery_plan`.
13. Governance: review `fabric_get_audit_log` after mutating actions, use `fabric_generate_deploy_playbook` for guided execution, and use `fabric_finalize_mutation_evidence` for auditable closure.

## Common Prompts

- "List my Fabric workspaces and identify known environments."
- "Create a workspace snapshot with dependency graph for this workspace."
- "Preflight this deployment pipeline stage before production."
- "Run this Fabric item job in test after checking policy."
- "Diagnose this failed job instance and produce a runbook."
- "Compare these Fabric item definitions and generate a deployment review."
- "Check Fabric Git status before deploying this stage."
- "Build a control-room snapshot and render the HTML report."
- "Correlate this incident and generate a recovery plan."
- "Create a change assurance report and score for this deployment."
- "Fingerprint dev and prod, then show environment drift."
