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
