# Tool Catalog

The plugin also bundles the `fabric-operator` skill. Use it when a user asks Codex to inspect, deploy, diagnose, or govern Microsoft Fabric.

## Inventory

### `fabric_list_workspaces`

Lists Fabric workspaces accessible to the current identity.

### `fabric_get_workspace`

Gets one Fabric workspace, including capacity assignment metadata when available.

### `fabric_list_items`

Lists Fabric items in a workspace. Supports optional type filtering.

### `fabric_get_item`

Gets one Fabric item by workspace ID and item ID.

### `fabric_workspace_snapshot`

Creates a compact workspace snapshot with item counts, type counts, known environment mapping, warnings, and optional dependency graph.

### `fabric_workspace_health_score`

Computes a local health score from workspace metadata, item inventory, known environments, capacity signals, and optional Git status.

## Deployment

### `fabric_list_deployment_pipelines`

Lists Fabric deployment pipelines.

### `fabric_get_deployment_pipeline`

Gets one deployment pipeline.

### `fabric_list_deployment_stages`

Lists stages in a deployment pipeline.

### `fabric_list_stage_items`

Lists stage items assigned to a deployment pipeline stage.

### `fabric_deployment_preflight`

Validates pipeline ID, workspace ID, stage context, selected item count, environment label, production flags, and risk.

### `fabric_deploy_stage_content`

Deploys stage content with guardrails and long-running operation polling.

### `fabric_get_operation_state`

Gets the current state of a Fabric long-running operation.

### `fabric_get_operation_result`

Gets the result of a completed Fabric long-running operation.

## Git Integration

### `fabric_git_get_connection`

Gets Git connection details for a Fabric workspace.

### `fabric_git_get_status`

Gets Git status for a Fabric workspace.

### `fabric_git_connect`

Connects a workspace to a Git repository and branch with mutation guardrails.

### `fabric_git_disconnect`

Disconnects a workspace from Git with mutation guardrails.

### `fabric_git_commit`

Commits workspace changes to the connected Git branch with mutation guardrails.

### `fabric_git_update_from_git`

Updates a workspace from the connected Git branch with mutation guardrails.

### `fabric_git_initialize_connection`

Initializes a Fabric Git connection after connect with mutation guardrails.

## Connections and Gateways

### `fabric_list_connections`

Lists Fabric connections accessible to the current identity.

### `fabric_get_connection`

Gets one Fabric connection by ID.

### `fabric_list_gateways`

Lists Fabric gateways accessible to the current identity.

### `fabric_get_gateway`

Gets one Fabric gateway by ID.

### `fabric_list_item_connections`

Lists connections used by a specific Fabric item.

### `fabric_check_connection_policy`

Checks connection and gateway IDs against the active local policy.

## Jobs and Runs

### `fabric_run_item_job`

Runs a supported Fabric item job with confirmation, target binding, and production guardrails.

### `fabric_get_job_instance`

Gets a Fabric job instance.

### `fabric_list_recent_job_instances`

Lists recent job instances for a Fabric item.

### `fabric_diagnose_failed_run`

Classifies and explains a failed job instance.

## Intelligence

### `fabric_get_item_definition`

Gets a Fabric item definition through the Fabric getDefinition API and can decode base64 definition parts. This improves graph and blast-radius accuracy when item definitions expose referenced IDs.

### `fabric_compare_item_definitions`

Compares two Fabric item definitions and summarizes added, removed, changed, and unchanged parts plus added and removed referenced IDs.

### `fabric_generate_deployment_review`

Generates a deployment review from real preflight, definition diff, graph, environment, and policy context. Blocks when no real review inputs are provided.

### `fabric_bulk_export_item_definitions`

Bulk exports Fabric item definitions from a workspace using the beta API. Requires `allowBeta: true` and policy beta approval.

### `fabric_package_workspace_definitions`

Creates a read-only package summary for workspace definitions using individual getDefinition calls.

### `fabric_generate_pull_request_summary`

Generates PR-ready Markdown from definition diff, deployment review, blast radius, and risk context. Blocks when no real source context is provided.

### `fabric_update_item_definition`

Updates one Fabric item definition with strict guardrails. Disabled by policy by default.

### `fabric_build_dependency_graph`

Builds a dependency graph from workspace items and, by default, supported item definitions. Edges are observed `definition-reference` relationships from Fabric definitions.

### `fabric_analyze_blast_radius`

Analyzes downstream impact for changed item IDs using observed definition references from Fabric definitions.

### `fabric_classify_risk`

Classifies action risk from environment label, item count, preflight state, and target binding.

### `fabric_generate_runbook`

Generates a Markdown runbook from action context, preflight results, diagnostics, or operation output. Blocks when no real context is provided.

## Governance

### `fabric_get_policy`

Reads the active local Fabric policy used by deployment and job guardrails.

### `fabric_get_audit_log`

Reads recent local audit log entries.

### `fabric_remember_environment`

Stores a non-sensitive local mapping between environment labels and Fabric target IDs.

### `fabric_list_known_environments`

Lists locally remembered environments.

## Admin and Capacity

### `fabric_admin_list_items`

Lists Fabric admin items. This is preview/admin mode and requires both `allowAdminPreview: true` in the tool input and `allowAdminPreview: true` in policy.

### `fabric_admin_get_item`

Gets one Fabric admin item. This is preview/admin mode and requires explicit admin preview approval.

### `fabric_list_capacities`

Lists Fabric capacities accessible to the current identity.

### `fabric_get_capacity`

Gets one Fabric capacity by ID.

## Incident Mode

### `fabric_diagnose_workspace_incident`

Builds a read-only incident summary from workspace metadata, item inventory, Git status, item connections, dependency graph, and recent audit context.

## vNext Readiness Addendum

### `fabric_list_workspace_role_assignments`

Lists role assignments for a Fabric workspace.

### `fabric_get_workspace_role_assignment`

Gets one role assignment for a Fabric workspace.

### `fabric_git_get_my_credentials`

Gets the current user's Fabric Git credentials configuration.

### `fabric_git_readiness`

Builds a read-only Git readiness report from workspace Git connection, status, and user credentials.

### `fabric_git_update_my_credentials`

Updates the current user's Git credentials configuration with guardrails.

### `fabric_list_supported_connection_types`

Lists Fabric supported connection types.

### `fabric_list_connection_role_assignments`

Lists role assignments for a Fabric connection.

### `fabric_test_connection`

Tests a Fabric connection and resolves the long-running operation when returned.

### `fabric_list_deployment_pipeline_operations`

Lists operations for a Fabric deployment pipeline.

### `fabric_get_deployment_pipeline_operation`

Gets one deployment pipeline operation with execution plan details.

## Innovation Layer

### `fabric_control_room_snapshot`

Builds a real control-room snapshot from workspace metadata, item inventory, Git status, role assignments, item connections, observed graph, policy, known environments, and recent audit.

### `fabric_build_lineage_map`

Builds a lineage map from Fabric item definitions, item connections, and optional deployment stage membership. Edges are observed from Fabric API evidence.

### `fabric_render_control_room_html`

Renders a visual HTML control-room report from a real `fabric_control_room_snapshot` result.

### `fabric_generate_change_cards`

Generates review-ready change cards from real preflight, definition diff, blast-radius, connection, permission, and capacity context.

### `fabric_create_approval_packet`

Creates a deterministic approval packet from preflight, review, risk, target binding, policy, and expiry context.

### `fabric_analyze_permissions`

Analyzes real workspace role assignments, Git credentials, connection role assignments, optional admin access, and policy checks for a requested operation.

### `fabric_analyze_capacity_risk`

Analyzes real workspace and capacity metadata for deployment, refresh, and incident risk signals.

### `fabric_correlate_incident`

Correlates real incident evidence across workspace metadata, Git status, item connections, job instances, capacity metadata, and recent audit.

### `fabric_generate_recovery_plan`

Generates a recovery plan from real workspace metadata, Git status, audit entries, optional operation output, and optional definition diff.

### `fabric_export_as_code_package`

Exports a Fabric-as-Code review package with item inventory, definitions, manifest checksum, observed graph, Git status, and audit context.

### `fabric_validate_live_mutation_readiness`

Validates non-production mutation readiness without executing the mutation, using guardrails, policy, target binding, preflight marker, and risk classification.

## Enterprise USP Layer

### `fabric_change_assurance_report`

Builds a read-only change assurance report from Fabric workspace, policy, Git, capacity, permissions, audit, preflight, diff, and approval evidence.

### `fabric_change_assurance_score`

Calculates a `0-100` assurance score with decision, reasons, blockers, and required release conditions.

### `fabric_change_assurance_html`

Renders a compact HTML change-board report from a real assurance report.

### `fabric_simulate_policy_on_workspace`

Simulates active policy against a real workspace without writing policy files.

### `fabric_suggest_policy_tightening`

Suggests policy tightening from workspace, Git, connection, and gateway evidence without editing policy files.

### `fabric_policy_diff`

Compares two policy versions and reports changed, newly allowed, and newly blocked controls.

### `fabric_fingerprint_workspace`

Creates an environment fingerprint from items, definition hashes, item connections, Git status, role assignments, and capacity metadata.

### `fabric_compare_environment_fingerprints`

Compares two fingerprints and reports environment drift.

### `fabric_drift_review_cards`

Generates review cards for item, definition, connection, Git, role, and capacity drift.

### `fabric_build_incident_timeline`

Builds a timeline from audit events, deployment operations, job instances, Git status, workspace metadata, and capacity evidence.

### `fabric_rank_root_causes`

Ranks root-cause candidates from incident timeline evidence.

### `fabric_incident_brief`

Creates executive and operator incident summaries from a timeline and root-cause ranking.

### `fabric_generate_deploy_playbook`

Generates a guided deployment playbook from preflight, approval packet, and target binding.

### `fabric_validate_playbook_step`

Validates one playbook step against supplied evidence.

### `fabric_finalize_mutation_evidence`

Creates final mutation evidence from request ID, operation ID, audit entries, and mutation result.

## Advanced USP Layer

### `fabric_build_approval_chain_evidence`

Builds deterministic approval-chain evidence from an approval packet, required approvers, expiry, and local audit entries.

### `fabric_forecast_capacity_cost_risk`

Forecasts release capacity and cost risk from real workspace/capacity metadata plus explicit planned-action estimates.

### `fabric_map_workspace_blast_radius`

Maps workspace blast radius from real item inventory, definitions, observed references, and optional changed item IDs.

### `fabric_review_data_sensitivity`

Reviews returned Fabric item metadata, definitions, and connections for sensitivity indicators without writing policies or exposing secrets.

### `fabric_release_readiness_gate`

Combines assurance, approval, drift, incident, sensitivity, and capacity evidence into a `go`, `conditional-go`, or `no-go` decision.

### `fabric_generate_compliance_evidence_bundle`

Generates a checksum-backed compliance evidence bundle from assurance, approval, policy, drift, sensitivity, capacity, release-gate, and audit evidence.

### `fabric_detect_audit_anomalies`

Detects unusual or high-risk local audit patterns such as blocked bursts, admin preview use, and production-like confirmed actions.

### `fabric_suggest_least_privilege_roles`

Suggests least-privilege role reviews from real workspace role assignments for a requested operation.

### `fabric_evaluate_policy_exception`

Evaluates a proposed policy exception without saving it, requiring reason, expiry, scope, and compensating controls.

### `fabric_build_release_risk_matrix`

Builds a compact release risk matrix from assurance, approval, capacity, sensitivity, drift, audit, and policy exception evidence.

### `fabric_simulate_what_if_deployment`

Simulates likely deployment outcome from policy, drift, blast-radius, and changed-item evidence without executing a mutation.

### `fabric_assess_rollback_readiness`

Assesses rollback readiness from real workspace Git status, exported definitions, and recent audit evidence.

### `fabric_analyze_ownership_coverage`

Analyzes workspace ownership coverage from real item inventory and role assignment evidence.

### `fabric_review_data_contracts`

Reviews Fabric item definitions for data-contract signals such as schema, version, table, and column terms.

### `fabric_summarize_tenant_posture`

Summarizes tenant-level posture from real workspace inventory, capacity metadata, and active local policy.

### `fabric_evaluate_operational_slo`

Evaluates operational SLO from supplied job evidence and recent local audit status signals.

### `fabric_score_workspace_criticality`

Scores workspace criticality from real item inventory, role assignments, recent audit, and optional capacity risk evidence.

### `fabric_check_change_freeze_window`

Checks whether a proposed change is currently blocked by explicit freeze-window evidence.

### `fabric_build_access_recertification_packet`

Builds a checksum-backed access recertification packet from real workspace role assignments.

### `fabric_generate_executive_release_brief`

Generates an executive release brief from release gate, risk matrix, workspace criticality, and operational SLO evidence.

### `fabric_build_operator_action_queue`

Builds a prioritized operator action queue from release gate, risk matrix, rollback, ownership, contract, and SLO evidence.

### `fabric_estimate_business_impact`

Estimates business impact from item inventory, criticality, affected users, and optional revenue-at-risk evidence.

### `fabric_identify_dependency_bottlenecks`

Identifies high fan-in or fan-out bottlenecks from a Fabric dependency graph.

### `fabric_detect_release_calendar_collisions`

Detects release calendar collisions from proposed and existing release windows without writing schedules.

### `fabric_generate_recovery_drill`

Generates a recovery drill plan from rollback readiness and incident brief evidence.

### `fabric_score_control_maturity`

Scores release control maturity from supplied assurance, policy, drift, approval, gate, compliance, rollback, and SLO evidence.

## Workflow Recipes

### `fabric_list_workflow_recipes`

Lists bundled workflow recipes that map specialized skills to ordered tool chains.

### `fabric_get_workflow_recipe`

Gets one workflow recipe by ID.

### `fabric_generate_workflow_prompt`

Generates a ready-to-use operator prompt from a bundled workflow recipe.

## Learning Layer

### `fabric_get_learning_status`

Shows local governed-learning status, storage path, record counts, and last learning activity.

### `fabric_record_learning_event`

Records a redacted local learning event from diagnostics, preflight, deployment review, or operator context.

### `fabric_record_task_memory`

Records a structured task memory with goal, plan summary, tools used, assumptions, decisions, outcome, lesson, and next-time guidance. It stores structured summaries, not full chat transcripts.

### `fabric_find_similar_task_memories`

Finds prior tasks similar to a new Fabric goal by task type, workspace, environment, item, pipeline, outcome, and key terms.

### `fabric_recommend_next_task_steps`

Recommends a safe next tool sequence using similar task memories, learned lessons, policy signals, and known risks.

### `fabric_record_operator_feedback`

Records explicit feedback for a diagnosis, lesson, playbook, risk score, tool result, or task memory.

### `fabric_list_learned_lessons`

Lists learned lessons filtered by workspace, environment, lesson type, or confidence.

### `fabric_analyze_learning_patterns`

Aggregates repeated issues, high-risk scopes, repeated task failures, and accepted recommendations.

### `fabric_generate_learned_playbook`

Builds a markdown-ready playbook from learned lessons and matching task memories.

### `fabric_suggest_policy_improvements`

Suggests advisory policy improvements from repeated local learning patterns. It never writes policy files.

### `fabric_export_learning_evidence`

Exports redacted local learning evidence for marketplace, compliance, or release review.
