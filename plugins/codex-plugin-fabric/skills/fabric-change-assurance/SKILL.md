---
name: fabric-change-assurance
description: Build Microsoft Fabric change assurance reports, scores, approval packets, and board-ready evidence before high-impact changes.
---

# Fabric Change Assurance

Use this skill when a user asks for deployment review, change approval, go/no-go decisions, risk scoring, or board-ready evidence for Microsoft Fabric changes.

## Operating Rules

- Start from real evidence: preflight, Git status, definition diff, capacity metadata, permissions, lineage, and audit.
- Do not approve a mutation based on a score alone; require target binding and guardrail fields.
- Treat missing preflight, missing approval, dirty Git, and policy blockers as release blockers.
- Use HTML output only as a local evidence view.

## Workflow

1. Collect target context with `fabric_get_workspace`, `fabric_list_items`, and `fabric_git_get_status`.
2. Run `fabric_deployment_preflight` for deployment changes.
3. For definition changes, call `fabric_get_item_definition` and `fabric_compare_item_definitions`.
4. Build `fabric_change_assurance_report`.
5. Score with `fabric_change_assurance_score`.
6. Render `fabric_change_assurance_html` when the user needs a board-ready report.
7. If ready, generate or validate approval with `fabric_create_approval_packet` and `fabric_validate_live_mutation_readiness`.

## Common Prompts

- "Create a change assurance report for this Fabric deployment."
- "Score this planned Fabric change and list release blockers."
- "Render a change-board HTML report for this deployment."
