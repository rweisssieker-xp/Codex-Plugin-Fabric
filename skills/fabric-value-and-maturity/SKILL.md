---
name: fabric-value-and-maturity
description: Assess Microsoft Fabric business impact, dependency bottlenecks, release calendar collisions, recovery drills, and control maturity.
---

# Fabric Value And Maturity

Use this skill when a user asks for value, maturity, business impact, or release portfolio insight.

## Operating Rules

- Keep analysis read-only and evidence-backed.
- Do not write release calendars or change schedules.
- Use business impact and maturity scores as decision support, not as automatic approval.

## Workflow

1. Estimate business impact with `fabric_estimate_business_impact`.
2. Identify dependency bottlenecks with `fabric_identify_dependency_bottlenecks`.
3. Detect release collisions with `fabric_detect_release_calendar_collisions`.
4. Generate recovery drill evidence with `fabric_generate_recovery_drill`.
5. Score control maturity with `fabric_score_control_maturity`.

## Common Prompts

- "Assess the business impact and maturity of this Fabric release."
- "Find bottlenecks and calendar collisions before approval."
- "Generate a recovery drill and control maturity score."
