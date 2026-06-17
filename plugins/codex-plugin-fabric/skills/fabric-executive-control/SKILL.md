---
name: fabric-executive-control
description: Create executive Microsoft Fabric release control evidence with workspace criticality, freeze windows, access recertification, release briefs, and operator action queues.
---

# Fabric Executive Control

Use this skill when a user asks for a management-ready release view or control board summary.

## Operating Rules

- Keep all outputs evidence-backed and read-only.
- Separate executive summary from operator actions.
- Treat active freeze windows, privileged access review, high criticality, and unresolved release blockers as board-level controls.

## Workflow

1. Score criticality with `fabric_score_workspace_criticality`.
2. Check freezes with `fabric_check_change_freeze_window`.
3. Build access evidence with `fabric_build_access_recertification_packet`.
4. Generate the executive brief with `fabric_generate_executive_release_brief`.
5. Build the operator queue with `fabric_build_operator_action_queue`.

## Common Prompts

- "Create an executive control brief for this Fabric release."
- "Build the operator action queue for unresolved release blockers."
- "Check criticality, freeze window, and access review before board approval."
