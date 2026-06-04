# Tool Catalog

The plugin also bundles the `fabric-operator` skill. Use it when a user asks Codex to inspect, deploy, diagnose, or govern Microsoft Fabric.

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

### `fabric_get_item_definition`

Gets a Fabric item definition through the Fabric getDefinition API and can decode base64 definition parts. This improves graph and blast-radius accuracy when item definitions expose referenced IDs.

### `fabric_build_dependency_graph`

Builds a dependency graph from workspace items. By default it uses type-based inferred relationships. With `includeDefinitions: true`, it also reads supported item definitions and adds observed `definition-reference` edges.

### `fabric_analyze_blast_radius`

Analyzes likely downstream impact for changed item IDs. With `includeDefinitions: true`, blast-radius analysis uses observed definition references where available.

### `fabric_classify_risk`

Classifies action risk from environment label, item count, preflight state, and target binding.

### `fabric_generate_runbook`

Generates a Markdown runbook from action context, preflight results, diagnostics, or operation output.

## Governance

### `fabric_get_policy`

Reads the active local Fabric policy used by deployment and job guardrails.

### `fabric_get_audit_log`

Reads recent local audit log entries.

### `fabric_remember_environment`

Stores a non-sensitive local mapping between environment labels and Fabric target IDs.

### `fabric_list_known_environments`

Lists locally remembered environments.
