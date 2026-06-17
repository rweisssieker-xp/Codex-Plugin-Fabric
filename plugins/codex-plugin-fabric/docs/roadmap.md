# Roadmap

## V1: Secure Operator Core

- Workspace inventory
- Item inventory
- Deployment pipeline inspection
- Deployment preflight
- Guarded deployment execution
- Long-running operation polling
- Supported item job execution
- Failed run diagnostics
- Local audit logging
- Local environment memory

## V1.5: Intelligence Layer

- Better dependency graph enrichment
- Stronger blast-radius analysis
- Workspace health scoring
- Deployment risk scoring improvements
- Runbook templates by failure category
- Environment fingerprinting
- Connections and gateway intelligence
- Definition diff and deployment reviews
- Capacity-aware workspace snapshots

## V2: Fabric-as-Code Bridge

- Export support where Fabric APIs allow it
- Import support where safe and supported
- Definition diffing
- Git sync assistance
- Deployment review summaries
- Pull request friendly Fabric change reports
- Guarded Git connect, commit, disconnect, and update-from-Git workflows
- Marketplace verification as a release gate

## V3: Visual Control Room

- Control-room snapshot tool
- HTML control-room renderer
- Observed workspace graph and lineage view
- Incident correlation evidence
- Audit and policy context in one report
- Capacity, permission, and mutation-readiness analysis

## V4: Enterprise Assurance Layer

- Change assurance reports and scoring
- Policy-as-code simulation and tightening suggestions
- Environment fingerprinting and drift review cards
- Incident timeline and root-cause ranking
- Guided mutation playbooks and final evidence packages

## V5: Governed Self-Learning Operator

- Local task memories from completed Fabric operations
- Tool usage learning from diagnostics, preflights, reviews, and incidents
- Explicit operator feedback for accepted, rejected, helpful, or wrong recommendations
- Similar-task lookup and safe next-step recommendations
- Learned playbooks generated from repeated evidence
- Advisory policy improvement suggestions
- Redacted learning evidence export for compliance and marketplace review

## Non-Goals for Early Releases

- Destructive operations
- Blind automatic repair
- Replacing Fabric deployment pipelines
- Storing credentials
- Circumventing tenant or workspace permissions
- Full chat transcript capture
- Automatic policy rewrites from learned recommendations
