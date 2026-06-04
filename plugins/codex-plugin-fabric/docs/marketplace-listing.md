# Marketplace Listing Copy

## Plugin Name

Microsoft Fabric Control

## Short Description

Safe Codex control plane for Microsoft Fabric.

## Long Description

Microsoft Fabric Control turns Codex into a governed operator for Microsoft Fabric. The plugin exposes MCP tools for workspace inventory, deployment pipeline control, job execution, run diagnostics, dependency intelligence, blast-radius analysis, risk scoring, local environment memory, and audit logging.

It is designed for teams that want agentic Fabric operations without giving up production safety. Read-only tools run directly. Mutating tools require explicit confirmation, target binding, environment labels, and additional production approval when the target looks live or production-like.

## Category

Data

## Keywords

Microsoft Fabric, Power BI, Lakehouse, Warehouse, Data Pipeline, Deployment Pipeline, MCP, Codex, DataOps, Governance, Audit, Diagnostics

## Visual Assets

- Composer icon: `assets/icon.svg`
- Logo: `assets/logo.svg`
- Screenshots: `assets/screenshot-1.png`, `assets/screenshot-2.png`, `assets/screenshot-3.png`

## Install Command

```bash
npx codex-marketplace add <owner>/<repo>/plugins/codex-plugin-fabric --plugin
```

Repository-wide install:

```bash
npx codex-marketplace add <owner>/<repo> --plugins
```

## Starter Prompts

- List my Fabric workspaces and summarize the accessible environments.
- Build a workspace snapshot for this Fabric workspace.
- Preflight this Fabric deployment before production release.
- Diagnose the failed Fabric job run and suggest next steps.
- Build a dependency graph and show the likely blast radius.

## Positioning Statement

Microsoft Fabric Control is the safety-first Fabric operator plugin for Codex: it combines Fabric automation, deployment intelligence, diagnostics, and governance controls in one local MCP bundle.

## Target Users

- Data platform engineers
- Analytics engineers
- BI developers
- Fabric administrators
- DevOps and DataOps teams
- Teams managing Dev/Test/Prod Fabric deployments

## Primary Value

Fabric teams get a natural-language operator that can inspect, validate, execute, monitor, and explain Fabric operations while enforcing production-safe guardrails.
