# Enterprise USPs

Codex Plugin Fabric differentiates beyond API execution by turning Microsoft Fabric operations into auditable evidence workflows.

## Change Assurance

Use `fabric_change_assurance_report`, `fabric_change_assurance_score`, and `fabric_change_assurance_html` before high-impact deployment or definition-apply work. The report combines real Fabric workspace evidence, Git status, role assignments, capacity data, policy, preflight, diff, approval, and audit context.

## Policy Simulation

Use `fabric_simulate_policy_on_workspace`, `fabric_suggest_policy_tightening`, and `fabric_policy_diff` to test policy impact before changing guardrails. These tools are read-only and never write policy files.

## Environment Drift

Use `fabric_fingerprint_workspace`, `fabric_compare_environment_fingerprints`, and `fabric_drift_review_cards` to detect drift between environments. Fingerprints include item checksums, definition hashes, connections, Git status, role assignments, and capacity metadata.

## Incident Intelligence

Use `fabric_build_incident_timeline`, `fabric_rank_root_causes`, and `fabric_incident_brief` to turn real audit, deployment operation, job, Git, workspace, and capacity evidence into an operator timeline and executive brief.

## Guided Playbooks

Use `fabric_generate_deploy_playbook`, `fabric_validate_playbook_step`, and `fabric_finalize_mutation_evidence` to guide guarded deployments and close the loop with request IDs, operation IDs, result data, and audit evidence.

## Operating Boundaries

- No destructive operations are introduced.
- No automatic rollback is performed.
- No secrets are written to source, state, reports, or audit.
- HTML reports are local evidence views, not hosted services.
