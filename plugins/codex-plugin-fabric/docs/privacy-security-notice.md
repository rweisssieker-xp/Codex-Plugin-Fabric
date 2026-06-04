# Privacy and Security Notice

## Data Handling

Microsoft Fabric Control runs locally as a Codex MCP plugin. It communicates with Microsoft Fabric APIs using the credentials configured by the user or organization.

## Credentials

The plugin reads authentication configuration from environment variables. It does not write secrets to source files, documentation, local state, or audit logs.

## Local State

The plugin may write non-sensitive environment memory such as:

- environment labels
- workspace IDs
- deployment pipeline IDs
- stage IDs
- notes entered by the user

Local state is stored under `.fabric-plugin/state` by default.

## Audit Logs

Mutating actions are logged locally as JSONL. Audit records are designed to support operational review while redacting sensitive fields.

## External Services

The plugin calls Microsoft Fabric REST APIs. It does not send Fabric data to unrelated third-party services.

## User Responsibility

Users and organizations are responsible for:

- Microsoft Entra app registration configuration
- Fabric tenant settings
- workspace permissions
- service principal authorization where applicable
- compliance review before production use

## V1 Safety Limits

V1 does not expose delete operations, workspace creation, automatic repair, or destructive rollback.

