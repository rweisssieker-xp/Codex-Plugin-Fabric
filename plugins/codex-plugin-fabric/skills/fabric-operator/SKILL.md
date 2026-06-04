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
- Treat dependency graph and blast-radius output as advisory unless it contains `observed` edges from item definitions.

## Preferred Workflow

1. Inventory: use `fabric_list_workspaces`, `fabric_list_items`, or `fabric_workspace_snapshot`.
2. Environment context: use `fabric_list_known_environments` and `fabric_get_policy`.
3. Deployment readiness: use `fabric_list_deployment_pipelines`, `fabric_list_deployment_stages`, `fabric_list_stage_items`, then `fabric_deployment_preflight`.
4. Execution: use `fabric_deploy_stage_content` or `fabric_run_item_job` only after guardrail requirements are satisfied.
5. Monitoring: use `fabric_get_operation_state`, `fabric_get_operation_result`, `fabric_get_job_instance`, or `fabric_list_recent_job_instances`.
6. Diagnostics: use `fabric_diagnose_failed_run`, `fabric_build_dependency_graph`, `fabric_analyze_blast_radius`, and `fabric_generate_runbook`.
7. Governance: review `fabric_get_audit_log` after mutating actions.

## Common Prompts

- "List my Fabric workspaces and identify known environments."
- "Create a workspace snapshot with dependency graph for this workspace."
- "Preflight this deployment pipeline stage before production."
- "Run this Fabric item job in test after checking policy."
- "Diagnose this failed job instance and produce a runbook."

