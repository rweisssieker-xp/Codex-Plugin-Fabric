---
name: fabric-release-manager
description: Guide safe Microsoft Fabric deployments with playbooks, readiness checks, approval evidence, and final mutation evidence.
---

# Fabric Release Manager

Use this skill when a user asks to prepare, guide, validate, or close a Microsoft Fabric release.

## Operating Rules

- Keep release preparation read-only until all guardrails are satisfied.
- Require preflight, target binding, environment label, approval evidence, and mutation readiness before execution.
- Use playbooks to guide humans/operators; do not bypass guarded mutation tools.
- Finalize every mutation with request ID, operation ID, result, and audit evidence.

## Workflow

1. Run `fabric_deployment_preflight`.
2. Build assurance with `fabric_change_assurance_report` and `fabric_change_assurance_score`.
3. Create an approval packet with `fabric_create_approval_packet`.
4. Generate a playbook with `fabric_generate_deploy_playbook`.
5. Validate each step with `fabric_validate_playbook_step`.
6. Execute only through guarded mutation tools such as `fabric_deploy_stage_content`.
7. Finalize evidence with `fabric_finalize_mutation_evidence`.

## Common Prompts

- "Prepare a guided release playbook for this deployment."
- "Validate this playbook step before deployment."
- "Finalize mutation evidence for the completed deployment."
