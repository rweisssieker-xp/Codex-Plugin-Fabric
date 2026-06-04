# Tool Catalog

## Inventory

### `fabric_list_workspaces`

Lists Fabric workspaces accessible to the current identity.

### `fabric_list_items`

Lists Fabric items in a workspace. Supports optional type filtering.

### `fabric_get_item`

Gets one Fabric item by workspace ID and item ID.

### `fabric_workspace_snapshot`

Creates a compact workspace snapshot with item counts, type counts, known environment mapping, warnings, and optional dependency graph.

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

### `fabric_build_dependency_graph`

Builds a heuristic dependency graph from workspace items.

### `fabric_analyze_blast_radius`

Analyzes likely downstream impact for changed item IDs.

### `fabric_classify_risk`

Classifies action risk from environment label, item count, preflight state, and target binding.

### `fabric_generate_runbook`

Generates a Markdown runbook from action context, preflight results, diagnostics, or operation output.

## Governance

### `fabric_get_audit_log`

Reads recent local audit log entries.

### `fabric_remember_environment`

Stores a non-sensitive local mapping between environment labels and Fabric target IDs.

### `fabric_list_known_environments`

Lists locally remembered environments.

