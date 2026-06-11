# Data Product Governance Design

## Goal

Add a read-only Data Product Control Model to Codex Plugin Fabric. The feature lets operators assess a Microsoft Fabric workspace or item set as a governed data product across release readiness and operational maturity.

The feature must not certify products, mutate Fabric resources, write policy files, or create external state. It produces evidence-backed JSON through MCP tools and follows the existing `safeTool`, endpoint registry, skill, workflow recipe, and test patterns.

## Scope

In scope:

- Score a Fabric data product from returned Fabric evidence and optional existing governance evidence.
- Map downstream consumer and dependency signals from graph, item metadata, reports, semantic models, role assignments, and optional explicit consumers.
- Validate data product contract evidence such as schema, version, owner, SLA/SLO, deprecation, and breaking-change indicators.
- Check certification readiness with blockers, warnings, and required conditions.
- Generate a concise governance brief for data owners, platform teams, and change boards.
- Add a bundled skill and workflow recipe for the new workflow.

Out of scope:

- Writing certification status to Fabric or local state.
- Creating or editing policies.
- Calling destructive or mutating Fabric APIs.
- Inventing consumer, quality, lineage, or contract evidence that was not returned or explicitly supplied.

## New MCP Tools

### `fabric_score_data_product`

Scores data product maturity from:

- Fabric workspace and item inventory.
- Role assignment and owner evidence.
- Optional contract validation.
- Optional sensitivity review.
- Optional operational SLO.
- Optional environment drift.
- Optional release gate.
- Optional criticality and business impact.

Output:

- `score` from `0` to `100`.
- `level`: `gold`, `silver`, `bronze`, or `not-ready`.
- `drivers`, `blockers`, `warnings`, and `requiredConditions`.

### `fabric_map_data_product_consumers`

Builds a consumer map from:

- Dependency graph nodes and edges.
- Fabric item types, especially Reports and Semantic Models.
- Workspace role assignments.
- Optional explicit consumer list supplied by the operator.

Output:

- Consumer records with source, confidence, and evidence.
- Downstream item count.
- High-dependency consumer warnings when relevant.

### `fabric_validate_data_product_contract`

Validates contract evidence for a data product.

Inputs:

- Definitions or explicit contract object.
- Required terms, defaulting to `schema`, `version`, `owner`, `sla`, and `deprecationPolicy`.
- Optional previous contract or definition for breaking-change detection.

Output:

- `status`: `pass`, `review`, or `fail`.
- Missing terms.
- Breaking-change signals.
- Required conditions.

### `fabric_check_data_product_certification`

Combines score, contract validation, consumer map, sensitivity, ownership, SLO, and release gate evidence into a certification readiness decision.

Output:

- `decision`: `certified-ready`, `conditional`, or `not-ready`.
- Blockers, warnings, and required conditions.

This tool only evaluates readiness. It does not persist certification.

### `fabric_generate_data_product_governance_brief`

Creates a compact governance brief from score, consumer map, contract validation, certification readiness, and optional release or business evidence.

Output:

- Summary.
- Audience-specific notes for data owner, platform team, and change board.
- Evidence checksums for traceability.

## Core Implementation

Add pure functions to `src/usp.ts`:

- `scoreDataProduct(input)`
- `mapDataProductConsumers(input)`
- `validateDataProductContract(input)`
- `checkDataProductCertification(input)`
- `generateDataProductGovernanceBrief(input)`

These functions must be deterministic except for timestamps in brief generation where already accepted by local evidence patterns. They should accept plain evidence objects and return JSON-friendly objects.

Add MCP registration to `src/tools/advancedUsps.ts` because this feature belongs to the current Advanced USP layer and reuses existing helper patterns:

- `safeTool`
- `UuidSchema`
- `valuesArray`
- local `fetchDefinitions` helper

Where real Fabric reads are useful:

- `fabric_score_data_product` can read workspace items and role assignments when `workspaceId` is provided.
- `fabric_validate_data_product_contract` can read item definitions when `workspaceId` and item IDs are provided.
- `fabric_map_data_product_consumers` can accept a graph directly or use supplied evidence; it should not attempt a broad expensive graph build unless input already includes graph evidence.

## Registry And Packaging

Update:

- `src/fabricEndpoints.ts`
- `src/fabricEndpoints.test.ts`
- `scripts/smoke-mcp.mjs`
- `scripts/verify-endpoints.mjs`
- `README.md`
- `docs/tool-catalog.md`
- `docs/skills.md`
- `docs/submission-checklist.md`

Add bundled skill files:

- `plugins/codex-plugin-fabric/skills/fabric-data-product-governor/SKILL.md`
- `skills/fabric-data-product-governor/SKILL.md`

Add workflow recipe:

- `id`: `data-product-governance`
- `skill`: `fabric-data-product-governor`
- Tools in order:
  - `fabric_validate_data_product_contract`
  - `fabric_map_data_product_consumers`
  - `fabric_score_data_product`
  - `fabric_check_data_product_certification`
  - `fabric_generate_data_product_governance_brief`

## Error Handling

- Missing evidence should be represented as blockers or warnings.
- Empty item inventories should return `not-ready` rather than throwing.
- Invalid contract inputs should return a failed contract validation with explicit missing terms.
- Optional evidence must not be treated as present unless supplied.

## Security And Governance

- All new tools are `mutating: false`.
- No DELETE metadata.
- No credentials or secrets in state, audit, or generated reports.
- The tools do not certify, approve, deploy, rollback, or mutate.
- Generated output is evidence and decision support only.

## Tests

Add unit tests for:

- Data product scoring blocks missing owners or failed contracts.
- Consumer mapping identifies downstream reports and explicit consumers.
- Contract validation fails missing required terms and detects breaking-change signals.
- Certification readiness returns `not-ready` when blockers exist.
- Governance brief includes decision, audience notes, and checksums.

Update existing registry and workflow tests to cover all new tools and the new skill.

Run after implementation:

- `npm test`
- `npm run smoke`
- `npm run verify:endpoints`
- `npm run verify:marketplace`
- `npm run export:tool-metadata`
- `npm run evidence:package`

`npm run verify:all` remains dependent on real Fabric Non-Prod environment variables for live smoke.
