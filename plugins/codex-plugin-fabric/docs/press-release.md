# Press Release

## Microsoft Fabric Control Brings Governed Fabric Operations to Codex

**New local MCP plugin helps teams inspect, deploy, diagnose, and govern Microsoft Fabric workflows from Codex.**

Microsoft Fabric Control is a new Codex plugin designed for teams operating Microsoft Fabric across development, test, and production environments. The plugin exposes a local MCP server with tools for workspace inventory, deployment pipeline control, item job execution, long-running operation monitoring, failed run diagnostics, dependency graphs, blast-radius analysis, risk scoring, runbook generation, local environment memory, and audit logging.

The plugin is built around a safety-first operating model. Read-only tools run directly, while mutating tools require explicit confirmation, environment labels, expected target IDs, and additional approval for production-like environments. V1 intentionally avoids destructive operations such as deletes, workspace creation, and automatic repair.

“Fabric teams need speed, but they also need control,” said the Fabric Control Contributors. “Microsoft Fabric Control gives Codex structured ways to operate Fabric with guardrails, diagnostics, and local auditability.”

The plugin is available as a Codex Marketplace-ready repository bundle and can be installed with:

```bash
npx codex-marketplace add <owner>/<repo>/plugins/codex-plugin-fabric --plugin
```

## Availability

Microsoft Fabric Control is designed for local Codex use and requires Microsoft Fabric access plus Microsoft Entra authentication configuration.

## About Microsoft Fabric Control

Microsoft Fabric Control is a local Codex MCP plugin for Microsoft Fabric operations, deployment intelligence, diagnostics, and governance.

