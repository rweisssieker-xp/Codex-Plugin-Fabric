---
name: fabric-environment-drift
description: Fingerprint Microsoft Fabric environments and explain drift between dev, test, and production.
---

# Fabric Environment Drift

Use this skill when a user asks whether Fabric environments match, why deployment targets differ, or what drift exists between workspaces.

## Operating Rules

- Use fingerprints from real Fabric API data only.
- Compare like-for-like workspaces and clearly label source and target.
- Treat definition, connection, role, Git, and capacity drift as separate evidence categories.
- Do not infer missing lineage or hidden dependencies.

## Workflow

1. Identify source and target workspace IDs.
2. Run `fabric_fingerprint_workspace` for each workspace.
3. Compare with `fabric_compare_environment_fingerprints`.
4. Generate review cards with `fabric_drift_review_cards`.
5. If a deployment is planned, feed the drift result into `fabric_change_assurance_report`.

## Common Prompts

- "Fingerprint dev and prod workspaces and show drift."
- "Explain why these Fabric environments differ."
- "Create drift review cards before deployment."
