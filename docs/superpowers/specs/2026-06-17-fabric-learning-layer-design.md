# Fabric Learning Layer Design

## Summary

The Fabric plugin should learn from local operations without becoming an uncontrolled autonomous actor. The first learning release adds a local SQLite-backed learning layer that captures redacted operational events, explicit operator feedback, learned lessons, reusable playbooks, and risk observations. It improves future diagnostics, preflight summaries, policy recommendations, and runbook generation while preserving the plugin's existing safety model.

The learning layer is local-first, non-secret, auditable, and advisory. It never changes Microsoft Fabric, local policy, or source code by itself.

## Goals

- Let the plugin remember useful operational knowledge across Codex sessions.
- Turn audit history and user feedback into ranked lessons and playbook suggestions.
- Improve risk and policy recommendations with observed evidence.
- Keep all learning local and redacted by default.
- Make learned knowledge exportable for evidence packages and marketplace review.

## Non-Goals

- No automatic Fabric mutations.
- No automatic policy rewrites.
- No self-modifying plugin code.
- No cloud training, telemetry upload, or central service.
- No credential, token, or secret persistence.
- No destructive repair or rollback automation.

## Architecture

The learning layer has four bounded parts:

1. `learningStore`
   - Owns the SQLite database.
   - Creates and migrates schema on startup or first use.
   - Stores events, feedback, lessons, playbooks, and risk observations.
   - Depends only on local config paths and a SQLite library.

2. `learning`
   - Contains deterministic learning logic.
   - Converts audit entries, feedback, diagnostics, and tool outputs into lessons.
   - Scores confidence using frequency, recency, accepted feedback, and severity.
   - Produces recommendations without side effects.

3. `tools/learning`
   - Exposes MCP tools for recording feedback, listing lessons, generating learned playbooks, analyzing patterns, suggesting policy improvements, and reporting learning status.
   - Uses existing `safeTool` and redaction patterns.

4. Documentation and evidence
   - Adds a Learning Layer section to the tool catalog and security docs.
   - Adds test coverage for schema creation, redaction, scoring, and advisory-only behavior.

## Data Model

The SQLite database lives under the existing local state directory as `learning.db`.

Tables:

- `learning_events`
  - `id`, `timestamp`, `source`, `toolName`, `workspaceId`, `itemId`, `pipelineId`, `environmentLabel`, `category`, `severity`, `summary`, `payloadJson`, `hash`

- `operator_feedback`
  - `id`, `timestamp`, `targetType`, `targetId`, `rating`, `comment`, `accepted`, `payloadJson`

- `learned_lessons`
  - `id`, `createdAt`, `updatedAt`, `lessonType`, `scopeKey`, `title`, `summary`, `confidence`, `evidenceCount`, `lastEvidenceAt`, `recommendation`, `payloadJson`

- `learned_playbooks`
  - `id`, `createdAt`, `updatedAt`, `name`, `scopeKey`, `trigger`, `stepsJson`, `confidence`, `sourceLessonIdsJson`, `payloadJson`

- `risk_observations`
  - `id`, `timestamp`, `workspaceId`, `itemId`, `pipelineId`, `riskLevel`, `reason`, `source`, `payloadJson`

All JSON payloads are redacted before storage. Inputs are size-limited to avoid turning the database into an unbounded data dump.

## MCP Tools

Initial tools:

- `fabric_get_learning_status`
  - Shows database location, counts, last learning event, and whether learning is enabled.

- `fabric_record_learning_event`
  - Records a redacted local event from diagnostics, preflight, deployment review, or operator context.
  - Read/write local only. No Fabric mutation.

- `fabric_record_operator_feedback`
  - Records explicit user feedback for a diagnosis, lesson, playbook, risk score, or tool result.

- `fabric_list_learned_lessons`
  - Lists lessons filtered by workspace, environment, category, confidence, or lesson type.

- `fabric_analyze_learning_patterns`
  - Aggregates repeated issues, high-risk workspaces, recurring policy blockers, and accepted recommendations.

- `fabric_generate_learned_playbook`
  - Builds a markdown-ready playbook from learned lessons and matching audit evidence.

- `fabric_suggest_policy_improvements`
  - Suggests policy changes based on repeated blocked or risky behavior.
  - Advisory only; never writes `fabric-policy.json`.

- `fabric_export_learning_evidence`
  - Produces a redacted evidence object for marketplace, compliance, or release review.

## Safety Model

- Learning is enabled by default for local redacted metadata, but can be disabled by policy.
- Raw Authorization headers, tokens, secrets, passwords, and client secrets are never stored.
- The store rejects payloads above a configured maximum size.
- Tools that write learning data are local-only and do not require production confirmation because they do not touch Fabric.
- Policy recommendation tools return diffs or suggestions only.
- Learned playbooks are suggestions. Existing guarded tools still enforce confirmation, target binding, preflight, and production flags.

## Policy Additions

New policy fields:

- `allowLocalLearning`
- `maxLearningPayloadBytes`
- `learningRetentionDays`
- `allowLearningEvidenceExport`
- `minLessonConfidenceForPolicySuggestions`

Defaults:

- local learning enabled
- evidence export enabled
- payload size capped
- policy suggestions require medium confidence or higher
- no automatic cleanup until retention is explicitly configured

## Error Handling

- If SQLite initialization fails, learning tools return a structured diagnostic and the rest of the plugin remains usable.
- If a payload exceeds the size limit, the tool records a compact summary and reports truncation.
- If a malformed feedback target is supplied, the tool returns validation errors through the existing MCP error pattern.
- If the DB is locked, tools return a retryable local-state error.

## Testing

Unit tests:

- Schema initializes in a temporary state directory.
- Redaction removes secrets recursively before insert.
- Oversized payloads are rejected or summarized.
- Feedback updates lesson confidence deterministically.
- Pattern analysis ranks repeated issues by severity, frequency, and recency.
- Policy suggestions are advisory and never write policy files.
- Evidence export omits secrets and includes checksums.

Smoke tests:

- MCP smoke expects the new learning tools.
- Endpoint registry marks learning tools as local, non-Fabric, non-mutating external operations.

## Documentation

Documentation updates:

- Tool catalog: Learning Layer section.
- Security governance: local learning, retention, redaction, and advisory-only guarantees.
- Operator guide: how to record feedback and reuse learned playbooks.
- Roadmap: V5 Governed Self-Learning Operator.
- Marketplace listing: USP language for governed self-learning.

## Open Implementation Choices

The recommended implementation uses SQLite because it supports durable local queries without introducing a server process. The preferred Node package should be selected during implementation based on installation reliability on Windows and Node 20. If native SQLite install friction is too high, the fallback is append-only JSONL plus generated indexes, but that should be treated as a downgrade.

## Approval Gate

Implementation can start once this design is approved. The first implementation block should add the store, deterministic learning functions, MCP tools, tests, docs, and smoke/endpoint registration.
