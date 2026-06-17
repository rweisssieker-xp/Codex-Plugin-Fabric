---
name: fabric-incident-commander
description: Build Microsoft Fabric incident timelines, rank root-cause candidates, and prepare executive/operator briefs.
---

# Fabric Incident Commander

Use this skill when a user asks to triage Fabric failures, correlate incidents, rank likely causes, or prepare an incident brief.

## Operating Rules

- Base timeline events only on returned Fabric API, audit, Git, capacity, deployment, or job evidence.
- Separate executive summary from operator details.
- Rank root causes by evidence, not speculation.
- Do not perform repair or rollback automatically.

## Workflow

1. Gather workspace evidence with `fabric_diagnose_workspace_incident` or `fabric_control_room_snapshot`.
2. For failed jobs, call `fabric_get_job_instance` and `fabric_diagnose_failed_run`.
3. Build timeline with `fabric_build_incident_timeline`.
4. Rank causes with `fabric_rank_root_causes`.
5. Create the brief with `fabric_incident_brief`.
6. If recovery is needed, use `fabric_generate_recovery_plan`.

## Common Prompts

- "Build an incident timeline for this workspace."
- "Rank likely root causes for this failed Fabric run."
- "Create an executive incident brief and operator detail."
