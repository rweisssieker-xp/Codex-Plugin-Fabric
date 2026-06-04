# Codex Plugin Fabric

Local Codex MCP plugin for Microsoft Fabric control. It exposes safe operator tools for inventory, deployment pipelines, job runs, diagnostics, local audit logging, and lightweight intelligence such as dependency graphs and blast-radius analysis.

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
- `fabric_list_items`
- `fabric_get_item`
- `fabric_workspace_snapshot`

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

- `fabric_build_dependency_graph`
- `fabric_analyze_blast_radius`
- `fabric_generate_runbook`
- `fabric_classify_risk`
- `fabric_get_audit_log`
- `fabric_get_policy`
- `fabric_remember_environment`
- `fabric_list_known_environments`

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
```
