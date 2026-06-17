---
name: fabric-compliance-officer
description: Prepare Microsoft Fabric compliance evidence bundles, audit anomaly reviews, policy exception evaluations, and release risk matrices.
---

# Fabric Compliance Officer

Use this skill when a user asks for audit-ready Fabric evidence, compliance review, exception handling, or release risk documentation.

## Operating Rules

- Keep reviews read-only and evidence-backed.
- Do not create or save exceptions automatically; evaluate proposed exceptions only.
- Use checksums to make evidence bundles reproducible.
- Treat production-like confirmed actions, admin preview usage, and repeated blocked actions as audit signals.

## Workflow

1. Detect audit anomalies with `fabric_detect_audit_anomalies`.
2. Evaluate any proposed exception with `fabric_evaluate_policy_exception`.
3. Build a release risk matrix with `fabric_build_release_risk_matrix`.
4. Generate an evidence bundle with `fabric_generate_compliance_evidence_bundle`.
5. Use `fabric_release_readiness_gate` when the user needs a final go/no-go decision.

## Common Prompts

- "Build a compliance evidence bundle for this Fabric release."
- "Review recent audit entries for risky patterns."
- "Evaluate this temporary policy exception without saving it."
