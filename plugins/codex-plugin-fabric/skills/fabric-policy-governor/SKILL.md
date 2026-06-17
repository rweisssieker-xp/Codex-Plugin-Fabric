---
name: fabric-policy-governor
description: Simulate, compare, and tighten Microsoft Fabric guardrail policies without writing policy files.
---

# Fabric Policy Governor

Use this skill when a user asks about Fabric policy hardening, guardrail simulation, policy diffs, or production readiness controls.

## Operating Rules

- Keep policy analysis read-only unless the user explicitly asks to edit policy files outside this skill.
- Prefer simulation against real workspace evidence over generic recommendations.
- Distinguish newly allowed controls from newly blocked controls.
- Never suggest disabling production preflight or target binding.

## Workflow

1. Read current policy with `fabric_get_policy`.
2. Gather workspace evidence with `fabric_get_workspace`, `fabric_list_items`, `fabric_git_get_status`, and connection/gateway tools when IDs are available.
3. Run `fabric_simulate_policy_on_workspace`.
4. Run `fabric_suggest_policy_tightening`.
5. Use `fabric_policy_diff` when comparing policy versions.
6. Present exact suggested JSON fields, but do not write policy files automatically.

## Common Prompts

- "Simulate our Fabric policy against this workspace."
- "Suggest a tighter policy for this production workspace."
- "Compare these two Fabric policy versions."
