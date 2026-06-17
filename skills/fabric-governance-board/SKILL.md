---
name: fabric-governance-board
description: Run evidence-backed Microsoft Fabric release gate reviews across approval, blast radius, sensitivity, capacity risk, drift, and assurance.
---

# Fabric Governance Board

Use this skill when a user asks whether a Fabric release should be approved, conditionally approved, or blocked.

## Operating Rules

- Base every recommendation on returned Fabric metadata, local policy, local audit, or explicit operator evidence.
- Keep the workflow read-only; do not create policies, mutate workspaces, or execute release actions.
- Treat missing approval, high capacity risk, high sensitivity findings, or blocked assurance as release blockers.
- Produce a clear `go`, `conditional-go`, or `no-go` decision with evidence and required conditions.

## Workflow

1. Build approval evidence with `fabric_build_approval_chain_evidence`.
2. Map blast radius with `fabric_map_workspace_blast_radius`.
3. Review sensitivity with `fabric_review_data_sensitivity`.
4. Forecast capacity/cost risk with `fabric_forecast_capacity_cost_risk`.
5. Combine those outputs with assurance, drift, and incident evidence in `fabric_release_readiness_gate`.

## Common Prompts

- "Run a governance board review for this Fabric release."
- "Tell me if this release is go, conditional-go, or no-go."
- "Create release gate evidence from approval, sensitivity, capacity, and drift signals."
