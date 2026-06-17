# Fabric-as-Code

Microsoft Fabric Control supports a guarded Fabric-as-Code workflow focused on review before apply.

## Read-First Flow

1. Get item definitions with `fabric_get_item_definition`.
2. Export batches with `fabric_bulk_export_item_definitions` when `allowBeta: true`.
3. Package workspace definitions with `fabric_package_workspace_definitions`.
4. Compare definitions with `fabric_compare_item_definitions`.
5. Generate a deployment review with `fabric_generate_deployment_review`.
6. Generate PR copy with `fabric_generate_pull_request_summary`.

## Guarded Apply

`fabric_update_item_definition` is disabled by default through policy. To enable it, policy and tool input must both explicitly approve the action.

Required controls:

- `allowDefinitionApply: true`
- `confirm: true`
- `environmentLabel`
- `expectedWorkspaceId`
- `expectedItemId`
- `preflightPassed: true`
- `definitionDiffApproved: true`
- `allowProduction: true` for production-like labels

Bulk import/apply is intentionally deferred because it has broader blast radius.

