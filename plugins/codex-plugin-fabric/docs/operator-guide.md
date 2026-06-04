# Operator Guide

## Operating Model

Microsoft Fabric Control follows a read-first, guarded-execute model.

1. Inspect the environment.
2. Identify the exact workspace, pipeline, stage, item, or job.
3. Run preflight checks for mutating actions.
4. Execute only with explicit confirmation and target binding.
5. Poll operations until a terminal state.
6. Review diagnostics and audit logs.

## Safe Read-Only Workflows

Use these prompts for low-risk inspection:

```text
List all Fabric workspaces I can access.
```

```text
List all DataPipeline and Notebook items in workspace <workspace-id>.
```

```text
Create a health snapshot for workspace <workspace-id>.
```

## Deployment Workflow

1. List deployment pipelines.
2. Get pipeline stages.
3. List stage items.
4. Run `fabric_deployment_preflight`.
5. Review risk level, blockers, source, target, and selected items.
6. Run `fabric_deploy_stage_content` only with confirmation and expected target IDs.

Example prompt:

```text
Preflight deployment pipeline <pipeline-id>, stage <stage-id>, environmentLabel production, expectedPipelineId <pipeline-id>, expectedWorkspaceId <workspace-id>.
```

Production deployment requires:

- `confirm: true`
- `allowProduction: true`
- `environmentLabel` that identifies the target
- `expectedPipelineId` or `expectedWorkspaceId`
- `preflightPassed: true`

## Run Diagnostics Workflow

1. Identify workspace ID, item ID, and job instance ID.
2. Call `fabric_get_job_instance`.
3. Call `fabric_diagnose_failed_run`.
4. Generate a runbook if the issue needs operational follow-up.

## Environment Memory

Use `fabric_remember_environment` to store non-sensitive mappings:

- `dev`
- `test`
- `production`
- workspace IDs
- deployment pipeline IDs
- stage IDs

This local state helps Codex check whether a later operation is targeting the expected environment.

## What the Plugin Will Not Do in V1

- Delete Fabric resources
- Create workspaces
- Automatically repair failed Fabric assets
- Store secrets in source files
- Execute production-like actions without explicit approval

