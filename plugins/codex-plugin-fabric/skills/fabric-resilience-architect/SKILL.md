---
name: fabric-resilience-architect
description: Design Microsoft Fabric release resilience with what-if simulation, rollback readiness, ownership coverage, data contracts, tenant posture, and operational SLO evidence.
---

# Fabric Resilience Architect

Use this skill when a user asks to harden a Fabric workspace or release before execution.

## Operating Rules

- Keep all checks read-only and evidence-backed.
- Prefer simulation, readiness, and contract checks before any mutation.
- Treat missing rollback definitions, weak tenant posture, orphaned ownership, failed contracts, or missed SLO as release-hardening work.

## Workflow

1. Simulate the deployment with `fabric_simulate_what_if_deployment`.
2. Assess rollback readiness with `fabric_assess_rollback_readiness`.
3. Analyze ownership coverage with `fabric_analyze_ownership_coverage`.
4. Review data contracts with `fabric_review_data_contracts`.
5. Summarize tenant posture with `fabric_summarize_tenant_posture`.
6. Evaluate operational SLO with `fabric_evaluate_operational_slo`.

## Common Prompts

- "Harden this Fabric release before deployment."
- "Run a resilience review for this workspace."
- "Check rollback, ownership, contracts, tenant posture, and SLO before release."
