# Operator Guide

## Operating Model

Microsoft Fabric Control follows a read-first, guarded-execute model.

1. Inspect the environment.
2. Identify the exact workspace, pipeline, stage, item, or job.
3. Run preflight checks for mutating actions.
4. Execute only with explicit confirmation and target binding.
5. Poll operations until a terminal state.
6. Review diagnostics and audit logs.

Git and admin workflows have extra gates. Git writes are mutating actions and require policy approval. Admin APIs are read-only but require explicit preview approval in both policy and tool input.

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

## Learning Workflow

The plugin can learn from structured task memories, local tool events, and explicit operator feedback. It does not store full chat transcripts.

Use `fabric_record_task_memory` when an operation produces a reusable lesson:

```text
Record a task memory: goal "Deploy semantic model to prod", taskType deployment, environmentLabel prod, outcome blocked, lesson "Git status must be clean before preflight", doNextTime "Run Git status first".
```

For future work, use `fabric_find_similar_task_memories` and `fabric_recommend_next_task_steps` before acting. These tools produce advisory next steps only; existing guardrails still control deployment, Git, production, and definition-apply actions.

Use `fabric_record_operator_feedback` when a recommendation was helpful, wrong, accepted, or rejected. Use `fabric_analyze_learning_patterns` and `fabric_suggest_policy_improvements` during governance review.

## What the Plugin Will Not Do in V1

- Delete Fabric resources
- Create workspaces
- Automatically repair failed Fabric assets
- Store secrets in source files
- Execute production-like actions without explicit approval
- Store complete chat transcripts as learning data
- Rewrite local policy automatically from learned recommendations

## Fabric-as-Code Workflow

Use Git status, item definitions, definition diff, and deployment review together:

1. Call `fabric_git_get_status`.
2. Call `fabric_get_item_definition` for source and target items.
3. Call `fabric_compare_item_definitions`.
4. Call `fabric_deployment_preflight` with Git status enabled.
5. Call `fabric_generate_deployment_review`.
6. Execute guarded Git or deployment mutation only after review.
