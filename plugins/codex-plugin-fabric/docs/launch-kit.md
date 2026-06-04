# Launch Kit

## Website Headline

Operate Microsoft Fabric from Codex with guardrails, diagnostics, and auditability.

## Subheadline

Microsoft Fabric Control turns Codex into a safe local operator for Fabric workspaces, deployment pipelines, jobs, run diagnostics, and dependency intelligence.

## Elevator Pitch

Microsoft Fabric Control is a Codex MCP plugin for teams that operate Fabric across development, test, and production. It lets Codex inspect workspaces, preflight deployments, start supported jobs, monitor operations, diagnose failed runs, generate runbooks, and enforce production guardrails.

## One-Liner

The safety-first Microsoft Fabric operator plugin for Codex.

## Three Key Benefits

1. Move faster with natural-language Fabric operations.
2. Reduce production mistakes with confirmation, target binding, preflight, and audit logs.
3. Understand failures faster with structured diagnostics and runbook generation.

## Differentiator Copy

Unlike generic scripts or portal-only workflows, Microsoft Fabric Control gives Codex a structured Fabric control plane with composable MCP tools, local state, redacted audit logs, risk scoring, and deployment intelligence.

## Social Post

Introducing Microsoft Fabric Control for Codex: a local MCP plugin that helps Codex inspect Fabric workspaces, preflight deployments, run jobs, diagnose failures, and enforce production guardrails.

## Launch Email

Subject: Operate Microsoft Fabric safely from Codex

Hi,

Microsoft Fabric Control is a new Codex plugin that brings governed Fabric operations into your local Codex workflow. It exposes MCP tools for workspace inventory, deployment pipeline control, job runs, diagnostics, dependency graphs, blast-radius analysis, runbooks, environment memory, and audit logs.

It is built for DataOps teams that need speed without giving up control. Read-only tools are simple. Mutating tools require explicit confirmation, expected target IDs, environment labels, and production approval when needed.

Install it from the marketplace:

```bash
npx codex-marketplace add <owner>/<repo>/plugins/codex-plugin-fabric --plugin
```

Thanks,
The Fabric Control Contributors

## FAQ

### Does it store credentials?

No. Secrets are read from environment variables and redacted from logs.

### Does it support service principals?

Yes, as an optional mode when the Fabric tenant setting and target API support service principals.

### Can it delete Fabric resources?

No. V1 intentionally avoids destructive operations.

### Does it replace Fabric deployment pipelines?

No. It helps Codex operate and inspect Fabric deployment pipelines safely.

