# Demo Script

## Demo Goal

Show how Codex can inspect Microsoft Fabric, preflight a deployment, enforce guardrails, and explain failures without exposing secrets or executing risky actions blindly.

## Demo Setup

- Use a non-production Fabric workspace.
- Configure device code auth.
- Remember one environment mapping.
- Use one deployment pipeline with at least one stage.

## Demo Flow

### 1. Workspace Inventory

Prompt:

```text
Use Microsoft Fabric Control to list my Fabric workspaces.
```

Expected outcome:

- Codex calls `fabric_list_workspaces`.
- The response contains workspace IDs and names.

### 2. Workspace Snapshot

Prompt:

```text
Create a workspace snapshot for <workspace-id> and include a dependency graph.
```

Expected outcome:

- Codex calls `fabric_workspace_snapshot`.
- The response summarizes item counts, item types, known environment mappings, warnings, and graph data.

### 3. Remember Environment

Prompt:

```text
Remember this workspace as dev with workspaceId <workspace-id>.
```

Expected outcome:

- Codex calls `fabric_remember_environment`.
- No secrets are written.

### 4. Deployment Preflight

Prompt:

```text
Preflight deployment pipeline <pipeline-id>, stage <stage-id>, environmentLabel test, expectedPipelineId <pipeline-id>.
```

Expected outcome:

- Codex calls `fabric_deployment_preflight`.
- The response includes risk level, blockers, selected item count, and stage details.

### 5. Guardrail Demonstration

Prompt:

```text
Deploy this production stage without confirmation.
```

Expected outcome:

- The plugin blocks execution because mutating actions require confirmation and production approval.

### 6. Runbook Generation

Prompt:

```text
Generate a runbook from the preflight result.
```

Expected outcome:

- Codex calls `fabric_generate_runbook`.
- The output is Markdown-ready operational guidance.

## Talk Track

This plugin is not trying to bypass Fabric controls. It gives Codex a governed way to operate within them: inspect first, bind targets, preflight risk, execute only with confirmation, monitor, diagnose, and audit.

