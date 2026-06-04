# Product Overview

## What It Is

Microsoft Fabric Control is a local Codex plugin that bundles an MCP server for Microsoft Fabric. It gives Codex structured tools to inspect Fabric workspaces, manage deployment pipelines, start supported item jobs, monitor long-running operations, diagnose failures, and generate operator runbooks.

## Why It Matters

Fabric is becoming a central platform for analytics, warehousing, lakehouses, semantic models, and BI delivery. Operational work still spans portals, scripts, IDs, logs, deployment stages, permissions, and tribal knowledge. This plugin compresses that work into a governed Codex workflow.

## Core Capabilities

- Workspace and item inventory
- Fabric item inspection
- Deployment pipeline discovery
- Deployment stage and stage item listing
- Deployment preflight checks
- Guarded stage deployment
- Long-running operation polling
- Supported item job execution
- Job instance inspection
- Failed run diagnostics
- Workspace health snapshots
- Dependency graph construction
- Blast-radius analysis
- Risk classification
- Runbook generation
- Local environment memory
- Local audit log review

## Differentiators

- Built as a Codex-native MCP plugin, not a generic script collection.
- Designed around production safety from the first release.
- Keeps secrets local and redacts sensitive fields in logs.
- Separates read-only tools from mutating tools.
- Uses target binding to reduce wrong-workspace and wrong-stage mistakes.
- Converts Fabric API errors into actionable diagnostic categories.
- Prepares for later Fabric-as-Code, Git sync, diffing, and visual control room features.

## Product Promise

Ask Codex to operate Fabric with context, guardrails, and auditability.

