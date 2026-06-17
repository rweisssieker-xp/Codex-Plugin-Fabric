# Security and Governance

## Design Principles

- Read-only operations are easy.
- Mutating operations are explicit.
- Production operations require stronger confirmation.
- Secrets stay out of source files.
- Audit trails are local and redacted.
- Diagnostics explain risk without performing blind repair.

## Authentication

The default authentication mode is Microsoft Entra device code flow through MSAL. Service principal mode is available only when configured and supported by the Fabric tenant and target API.

## Secret Handling

The plugin reads secrets from environment variables only. It redacts fields such as:

- Authorization
- accessToken
- refreshToken
- clientSecret
- secret
- password
- token

## Mutating Action Guardrails

Mutating actions require:

- `confirm: true`
- `environmentLabel`
- `expectedWorkspaceId` or `expectedPipelineId`

Production-like labels also require:

- `allowProduction: true`
- `preflightPassed: true`

## Local Policy File

Teams can provide `FABRIC_POLICY_PATH` to load a local `fabric-policy.json`. The policy can restrict workspace IDs, pipeline IDs, maximum deployment item count, maximum job payload size, blocked item types, and production preflight requirements.

The repository includes `fabric-policy.example.json`.

Use `fabric_get_policy` to confirm which policy is active at runtime.

Additional policy controls include guarded Git mutations, admin preview enablement, allowed Git providers, allowed connection IDs, allowed gateway IDs, clean-Git-before-deployment requirements, and maximum definition diff size.

Learning policy controls include local learning enablement, task-memory enablement, maximum learning payload size, evidence export permission, retention window, and minimum confidence for policy suggestions.

## Admin Preview APIs

Admin tools are read-only and blocked unless both the tool input and local policy explicitly enable admin preview mode. This keeps preview tenant-wide APIs separated from normal operator workflows.

## Git Mutations

Git connect, disconnect, commit, and update-from-Git are treated as mutating operations. They require confirmation, target binding, and policy approval.

## Audit Logging

Mutating actions are logged locally as JSONL. Audit records include:

- timestamp
- tool name
- target IDs
- status
- request ID
- operation ID
- redacted input
- redacted error

## Governed Local Learning

The learning layer stores structured local evidence only:

- task memories
- redacted learning events
- explicit operator feedback
- learned lessons
- learned playbooks
- risk observations

It does not store full chat transcripts. Task memories capture concise fields such as task goal, tool sequence, decisions, outcome, lesson, `doNextTime`, and `avoidNextTime`.

Learning recommendations are advisory. They cannot bypass confirmation, expected target binding, deployment preflight, `allowProduction`, admin preview gates, beta gates, or definition-apply gates. Policy suggestions are returned as recommendations only and never write `fabric-policy.json`.

## V1 Hard Blocks

The plugin intentionally does not expose:

- delete operations
- workspace creation
- automatic repair
- destructive rollback
- secret persistence

## Risk Categories

Diagnostics and risk classification use categories such as:

- Auth
- Permission
- RateLimit
- UnsupportedIdentity
- UnsupportedItemType
- Validation
- Timeout
- OperationFailure
