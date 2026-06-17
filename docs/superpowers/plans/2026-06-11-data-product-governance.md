# Data Product Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only Data Product Governance tools, skill, workflow recipe, docs, registry metadata, and tests to Codex Plugin Fabric.

**Architecture:** Implement deterministic pure functions in `plugins/codex-plugin-fabric/src/usp.ts`, expose them through MCP registrations in `plugins/codex-plugin-fabric/src/tools/advancedUsps.ts`, and wire the tools into existing endpoint, smoke, workflow, skill, and documentation patterns. The feature evaluates readiness only; it never certifies, mutates, writes policy, or creates external state.

**Tech Stack:** TypeScript, MCP SDK, Zod schemas, Node test runner, existing Fabric client helpers, existing `safeTool` response wrapper.

---

## File Structure

- Modify `plugins/codex-plugin-fabric/src/usp.ts`: add pure Data Product Governance functions.
- Modify `plugins/codex-plugin-fabric/src/usp.test.ts`: add unit tests for scoring, consumer map, contract validation, certification, and brief generation.
- Modify `plugins/codex-plugin-fabric/src/tools/advancedUsps.ts`: register five new MCP tools.
- Modify `plugins/codex-plugin-fabric/src/fabricEndpoints.ts`: add endpoint metadata for all new tools.
- Modify `plugins/codex-plugin-fabric/src/fabricEndpoints.test.ts`: assert registry metadata.
- Modify `plugins/codex-plugin-fabric/scripts/smoke-mcp.mjs`: add expected MCP tool names.
- Modify `plugins/codex-plugin-fabric/scripts/verify-endpoints.mjs`: require endpoint metadata.
- Modify `plugins/codex-plugin-fabric/src/workflowRecipes.ts`: add `data-product-governance` recipe.
- Modify `plugins/codex-plugin-fabric/src/workflowRecipes.test.ts`: assert new skill/recipe.
- Create `plugins/codex-plugin-fabric/skills/fabric-data-product-governor/SKILL.md`: bundled plugin skill.
- Create `skills/fabric-data-product-governor/SKILL.md`: root shim skill.
- Modify `plugins/codex-plugin-fabric/README.md`: list new tools and skill.
- Modify `plugins/codex-plugin-fabric/docs/tool-catalog.md`: document new tools.
- Modify `plugins/codex-plugin-fabric/docs/skills.md`: document new skill.
- Modify `plugins/codex-plugin-fabric/docs/submission-checklist.md`: add checklist entry.

---

### Task 1: Add Data Product Pure Function Tests

**Files:**
- Modify: `plugins/codex-plugin-fabric/src/usp.test.ts`

- [ ] **Step 1: Add imports for the new pure functions**

Add these names to the existing import from `./usp.js`:

```ts
  checkDataProductCertification,
  generateDataProductGovernanceBrief,
  mapDataProductConsumers,
  scoreDataProduct,
  validateDataProductContract,
```

- [ ] **Step 2: Add failing unit tests**

Append these tests to `plugins/codex-plugin-fabric/src/usp.test.ts`:

```ts
test("data product scoring blocks missing owner and failed contract", () => {
  const score = scoreDataProduct({
    items: [{ id: "model-1", type: "SemanticModel", displayName: "Finance Model" }],
    roleAssignments: [],
    contractValidation: { status: "fail", missingTerms: ["owner"] },
    operationalSlo: { status: "met" },
    releaseGate: { decision: "go" }
  });

  assert.equal(score.level, "not-ready");
  assert.ok(score.blockers.some((blocker) => blocker.includes("owner")));
  assert.ok(score.blockers.some((blocker) => blocker.includes("contract")));
});

test("data product consumer map includes graph reports and explicit consumers", () => {
  const map = mapDataProductConsumers({
    graph: {
      nodes: [
        { id: "model-1", label: "Finance Model", type: "SemanticModel" },
        { id: "report-1", label: "Finance Report", type: "Report" }
      ],
      edges: [{ from: "model-1", to: "report-1" }]
    },
    explicitConsumers: [{ id: "team-finance", name: "Finance Team" }]
  });

  assert.equal(map.downstreamItemCount, 1);
  assert.ok(map.consumers.some((consumer) => consumer.name === "Finance Report"));
  assert.ok(map.consumers.some((consumer) => consumer.name === "Finance Team"));
});

test("data product contract validation fails missing terms and detects breaking changes", () => {
  const validation = validateDataProductContract({
    contract: { schema: "finance", version: "2.0.0" },
    previousContract: { schema: "finance", version: "1.0.0", columns: ["amount", "region"] },
    requiredTerms: ["schema", "version", "owner", "sla", "deprecationPolicy"]
  });

  assert.equal(validation.status, "fail");
  assert.ok(validation.missingTerms.includes("owner"));
  assert.ok(validation.breakingChangeSignals.length > 0);
});

test("data product certification is not ready with blockers", () => {
  const certification = checkDataProductCertification({
    score: { level: "not-ready", blockers: ["Missing owner"] },
    contractValidation: { status: "fail", missingTerms: ["owner"] },
    consumerMap: { downstreamItemCount: 2, warnings: [] },
    releaseGate: { decision: "go" }
  });

  assert.equal(certification.decision, "not-ready");
  assert.ok(certification.blockers.length >= 2);
});

test("data product governance brief includes audience notes and checksum", () => {
  const brief = generateDataProductGovernanceBrief({
    score: { level: "silver", score: 72 },
    consumerMap: { downstreamItemCount: 3 },
    contractValidation: { status: "review" },
    certification: { decision: "conditional", warnings: ["Contract review required"] }
  });

  assert.equal(brief.decision, "conditional");
  assert.ok(brief.audienceNotes.dataOwner.length > 0);
  assert.ok(brief.audienceNotes.platformTeam.length > 0);
  assert.ok(brief.audienceNotes.changeBoard.length > 0);
  assert.ok(brief.checksum);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
cd C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric
npm test
```

Expected: TypeScript fails with missing exported function names from `src/usp.ts`.

---

### Task 2: Implement Data Product Pure Functions

**Files:**
- Modify: `plugins/codex-plugin-fabric/src/usp.ts`

- [ ] **Step 1: Add pure functions before `export function sha256`**

Insert:

```ts
export function scoreDataProduct(input: Record<string, unknown>) {
  const items = valuesFromUnknown(input.items);
  const roles = valuesFromUnknown(input.roleAssignments);
  const contract = input.contractValidation as Record<string, unknown> | undefined;
  const sensitivity = input.sensitivityReview as Record<string, unknown> | undefined;
  const slo = input.operationalSlo as Record<string, unknown> | undefined;
  const drift = input.environmentDrift as Record<string, unknown> | undefined;
  const releaseGate = input.releaseGate as Record<string, unknown> | undefined;
  const criticality = input.criticality as Record<string, unknown> | undefined;
  const impact = input.businessImpact as Record<string, unknown> | undefined;
  const blockers: string[] = [];
  const warnings: string[] = [];

  const hasOwner = roles.some((role) => stableStringify(role).toLowerCase().includes("owner") || stableStringify(role).toLowerCase().includes("admin") || stableStringify(role).toLowerCase().includes("member"));
  if (items.length === 0) blockers.push("Data product requires at least one Fabric item.");
  if (!hasOwner) blockers.push("Data product owner evidence is missing.");
  if (contract?.status === "fail") blockers.push("Data product contract validation failed.");
  if (contract?.status === "review") warnings.push("Data product contract requires review.");
  if (sensitivity?.status === "restricted-review") blockers.push("Sensitivity review requires restricted approval.");
  if (slo?.status === "missed") blockers.push("Operational SLO is missed.");
  if (slo?.status === "at-risk") warnings.push("Operational SLO is at risk.");
  if (drift?.equal === false) warnings.push("Environment drift is present.");
  if (releaseGate?.decision === "no-go") blockers.push("Release gate is no-go.");
  if (releaseGate?.decision === "conditional-go") warnings.push("Release gate is conditional.");

  let score = 100;
  score -= blockers.length * 25;
  score -= warnings.length * 8;
  if (Number(criticality?.score ?? 0) >= 70) score -= 5;
  if (impact?.level === "material") score -= 5;
  const normalized = Math.max(0, Math.min(100, score));

  return {
    score: normalized,
    level: blockers.length > 0 ? "not-ready" : normalized >= 85 ? "gold" : normalized >= 70 ? "silver" : "bronze",
    drivers: {
      itemCount: items.length,
      roleAssignmentCount: roles.length,
      criticality: criticality?.tier,
      businessImpact: impact?.level
    },
    blockers,
    warnings,
    requiredConditions: blockers.length > 0 ? blockers.map((blocker) => `Resolve: ${blocker}`) : warnings.map((warning) => `Review: ${warning}`)
  };
}

export function mapDataProductConsumers(input: Record<string, unknown>) {
  const graph = input.graph as { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> } | undefined;
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const explicitConsumers = valuesFromUnknown(input.explicitConsumers);
  const consumers = [];
  const downstreamIds = new Set(edges.map((edge) => stringValue(edge.to)).filter(Boolean));
  for (const node of nodes) {
    const id = stringValue(node.id);
    const type = stringValue(node.type);
    if (!id || !downstreamIds.has(id)) continue;
    if (type === "Report" || type === "SemanticModel") {
      consumers.push({
        id,
        name: stringValue(node.label) ?? stringValue(node.displayName) ?? id,
        source: "graph",
        confidence: "observed",
        evidence: node
      });
    }
  }
  for (const consumer of explicitConsumers) {
    const record = consumer as Record<string, unknown>;
    consumers.push({
      id: stringValue(record.id),
      name: stringValue(record.name) ?? stringValue(record.displayName) ?? "Explicit consumer",
      source: "explicit",
      confidence: "operator-supplied",
      evidence: record
    });
  }
  const warnings = consumers.length > 10 ? ["Data product has more than ten observed or supplied consumers."] : [];
  return { downstreamItemCount: downstreamIds.size, consumers, warnings };
}

export function validateDataProductContract(input: Record<string, unknown>) {
  const contract = input.contract ?? input.definition ?? {};
  const text = stableStringify(contract).toLowerCase();
  const requiredTerms = stringArray(input.requiredTerms).length > 0 ? stringArray(input.requiredTerms) : ["schema", "version", "owner", "sla", "deprecationPolicy"];
  const missingTerms = requiredTerms.filter((term) => !text.includes(term.toLowerCase()));
  const previousText = stableStringify(input.previousContract ?? input.previousDefinition ?? {}).toLowerCase();
  const breakingChangeSignals = [];
  if (previousText && previousText !== "{}" && text.includes("version") && !text.includes("deprecation")) breakingChangeSignals.push("Versioned contract changed without deprecation evidence.");
  if (previousText.includes("columns") && !text.includes("columns")) breakingChangeSignals.push("Previous contract referenced columns but current contract does not.");
  const blockers = [];
  const warnings = [];
  if (missingTerms.length > 2) blockers.push("Data product contract is missing required governance terms.");
  else if (missingTerms.length > 0) warnings.push("Data product contract is missing some recommended terms.");
  if (breakingChangeSignals.length > 0) warnings.push("Potential breaking-change signals detected.");
  return {
    status: blockers.length > 0 ? "fail" : warnings.length > 0 ? "review" : "pass",
    missingTerms,
    breakingChangeSignals,
    blockers,
    warnings,
    requiredConditions: blockers.length > 0 ? blockers : warnings
  };
}

export function checkDataProductCertification(input: Record<string, unknown>) {
  const score = input.score as Record<string, unknown> | undefined;
  const contract = input.contractValidation as Record<string, unknown> | undefined;
  const sensitivity = input.sensitivityReview as Record<string, unknown> | undefined;
  const ownership = input.ownershipCoverage as Record<string, unknown> | undefined;
  const slo = input.operationalSlo as Record<string, unknown> | undefined;
  const releaseGate = input.releaseGate as Record<string, unknown> | undefined;
  const blockers = [
    ...stringArray(score?.blockers),
    ...stringArray(contract?.blockers)
  ];
  const warnings = [
    ...stringArray(score?.warnings),
    ...stringArray(contract?.warnings)
  ];
  if (score?.level === "not-ready") blockers.push("Data product score is not ready.");
  if (contract?.status === "fail") blockers.push("Contract validation failed.");
  if (sensitivity?.status === "restricted-review") blockers.push("Sensitivity review requires restricted approval.");
  if (ownership && Number(ownership.coverage ?? 100) < 80) blockers.push("Ownership coverage is below certification threshold.");
  if (slo?.status === "missed") blockers.push("Operational SLO is missed.");
  if (releaseGate?.decision === "no-go") blockers.push("Release gate is no-go.");
  if (releaseGate?.decision === "conditional-go") warnings.push("Release gate is conditional.");
  return {
    decision: blockers.length > 0 ? "not-ready" : warnings.length > 0 ? "conditional" : "certified-ready",
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    requiredConditions: blockers.length > 0 ? [...new Set(blockers)] : [...new Set(warnings)]
  };
}

export function generateDataProductGovernanceBrief(input: Record<string, unknown>) {
  const score = input.score as Record<string, unknown> | undefined;
  const consumers = input.consumerMap as Record<string, unknown> | undefined;
  const contract = input.contractValidation as Record<string, unknown> | undefined;
  const certification = input.certification as Record<string, unknown> | undefined;
  const decision = stringValue(certification?.decision) ?? "unknown";
  const brief = {
    title: input.title ?? "Fabric Data Product Governance Brief",
    generatedAt: new Date().toISOString(),
    decision,
    summary: `Data product is ${decision}; score level ${String(score?.level ?? "unknown")}; contract ${String(contract?.status ?? "unknown")}; downstream consumers ${String(consumers?.downstreamItemCount ?? 0)}.`,
    audienceNotes: {
      dataOwner: stringArray(certification?.requiredConditions).length > 0 ? stringArray(certification?.requiredConditions) : ["Maintain ownership, contract, and consumer evidence."],
      platformTeam: ["Review Fabric evidence, role assignments, SLO, drift, and release gate before certification."],
      changeBoard: [`Certification readiness decision: ${decision}.`]
    },
    evidenceChecksums: {
      score: score ? sha256(score) : undefined,
      consumers: consumers ? sha256(consumers) : undefined,
      contract: contract ? sha256(contract) : undefined,
      certification: certification ? sha256(certification) : undefined
    }
  };
  return { ...brief, checksum: sha256(brief) };
}
```

- [ ] **Step 2: Run the USP tests**

Run:

```powershell
cd C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric
npm test
```

Expected: all tests pass or fail only on naming/type issues introduced by the pasted functions. Fix exact TypeScript diagnostics before continuing.

- [ ] **Step 3: Commit pure logic**

Run:

```powershell
git add src/usp.ts src/usp.test.ts
git commit -m "feat: add data product governance scoring logic"
```

Expected: commit succeeds.

---

### Task 3: Register MCP Tools

**Files:**
- Modify: `plugins/codex-plugin-fabric/src/tools/advancedUsps.ts`

- [ ] **Step 1: Add imports**

Add these imports from `../usp.js`:

```ts
  checkDataProductCertification,
  generateDataProductGovernanceBrief,
  mapDataProductConsumers,
  scoreDataProduct,
  validateDataProductContract,
```

- [ ] **Step 2: Add tool registrations before the closing brace of `registerAdvancedUspTools`**

```ts
  server.tool(
    "fabric_score_data_product",
    "Score a Fabric workspace or item set as a governed data product from ownership, contract, sensitivity, SLO, drift, release, criticality, and impact evidence.",
    {
      workspaceId: UuidSchema.optional(),
      items: z.array(z.record(z.unknown())).optional(),
      roleAssignments: z.record(z.unknown()).optional(),
      contractValidation: z.record(z.unknown()).optional(),
      sensitivityReview: z.record(z.unknown()).optional(),
      operationalSlo: z.record(z.unknown()).optional(),
      environmentDrift: z.record(z.unknown()).optional(),
      releaseGate: z.record(z.unknown()).optional(),
      criticality: z.record(z.unknown()).optional(),
      businessImpact: z.record(z.unknown()).optional()
    },
    ({ workspaceId, ...input }) =>
      safeTool(async () => {
        if (!workspaceId) return scoreDataProduct(input);
        const [itemsResponse, roleAssignments] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/roleAssignments`)
        ]);
        return {
          workspaceId,
          score: scoreDataProduct({ ...input, items: valuesArray(itemsResponse.data), roleAssignments: roleAssignments.data })
        };
      })
  );

  server.tool(
    "fabric_map_data_product_consumers",
    "Map downstream and explicit consumers for a Fabric data product from graph and operator-supplied consumer evidence.",
    {
      graph: z.record(z.unknown()).optional(),
      explicitConsumers: z.array(z.record(z.unknown())).optional()
    },
    (input) => safeTool(async () => mapDataProductConsumers(input))
  );

  server.tool(
    "fabric_validate_data_product_contract",
    "Validate Fabric data product contract evidence and detect missing terms or breaking-change signals.",
    {
      workspaceId: UuidSchema.optional(),
      itemIds: z.array(UuidSchema).optional(),
      contract: z.record(z.unknown()).optional(),
      previousContract: z.record(z.unknown()).optional(),
      requiredTerms: z.array(z.string().min(1)).optional(),
      maxItems: z.number().int().positive().max(100).optional().default(25)
    },
    ({ workspaceId, itemIds, maxItems, ...input }) =>
      safeTool(async () => {
        if (!workspaceId) return validateDataProductContract(input);
        const itemsResponse = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(itemsResponse.data);
        const selected = itemIds ? items.filter((item) => itemIds.includes(String((item as Record<string, unknown> | undefined)?.id))) : items.slice(0, maxItems);
        const definitions = await fetchDefinitions(context, workspaceId, selected);
        return {
          workspaceId,
          validation: validateDataProductContract({ ...input, definition: definitions })
        };
      })
  );

  server.tool(
    "fabric_check_data_product_certification",
    "Evaluate data product certification readiness without writing certification state.",
    {
      score: z.record(z.unknown()).optional(),
      contractValidation: z.record(z.unknown()).optional(),
      consumerMap: z.record(z.unknown()).optional(),
      sensitivityReview: z.record(z.unknown()).optional(),
      ownershipCoverage: z.record(z.unknown()).optional(),
      operationalSlo: z.record(z.unknown()).optional(),
      releaseGate: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => checkDataProductCertification(input))
  );

  server.tool(
    "fabric_generate_data_product_governance_brief",
    "Generate a concise governance brief for Fabric data owners, platform teams, and change boards.",
    {
      title: z.string().optional(),
      score: z.record(z.unknown()).optional(),
      consumerMap: z.record(z.unknown()).optional(),
      contractValidation: z.record(z.unknown()).optional(),
      certification: z.record(z.unknown()).optional(),
      releaseEvidence: z.record(z.unknown()).optional(),
      businessEvidence: z.record(z.unknown()).optional()
    },
    (input) => safeTool(async () => generateDataProductGovernanceBrief(input))
  );
```

- [ ] **Step 3: Run build**

Run:

```powershell
cd C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric
npm run build
```

Expected: TypeScript build passes.

- [ ] **Step 4: Commit MCP registration**

```powershell
git add src/tools/advancedUsps.ts
git commit -m "feat: expose data product governance tools"
```

Expected: commit succeeds.

---

### Task 4: Register Endpoint Metadata And Smoke Expectations

**Files:**
- Modify: `plugins/codex-plugin-fabric/src/fabricEndpoints.ts`
- Modify: `plugins/codex-plugin-fabric/src/fabricEndpoints.test.ts`
- Modify: `plugins/codex-plugin-fabric/scripts/smoke-mcp.mjs`
- Modify: `plugins/codex-plugin-fabric/scripts/verify-endpoints.mjs`

- [ ] **Step 1: Add endpoint metadata**

Append these entries before workflow recipe entries in `FABRIC_ENDPOINTS`:

```ts
  { tool: "fabric_score_data_product", group: "advanced_usps", method: "POST", path: "local://data-product-score", mutating: false },
  { tool: "fabric_map_data_product_consumers", group: "advanced_usps", method: "POST", path: "local://data-product-consumers", mutating: false },
  { tool: "fabric_validate_data_product_contract", group: "advanced_usps", method: "POST", path: "local://data-product-contract", mutating: false },
  { tool: "fabric_check_data_product_certification", group: "advanced_usps", method: "POST", path: "local://data-product-certification", mutating: false },
  { tool: "fabric_generate_data_product_governance_brief", group: "advanced_usps", method: "POST", path: "local://data-product-governance-brief", mutating: false },
```

- [ ] **Step 2: Add registry test coverage**

Add these tool names to the existing `endpoint registry includes advanced USP tools` list:

```ts
    "fabric_score_data_product",
    "fabric_map_data_product_consumers",
    "fabric_validate_data_product_contract",
    "fabric_check_data_product_certification",
    "fabric_generate_data_product_governance_brief"
```

- [ ] **Step 3: Add smoke expectations**

Add these strings to `expectedTools` in `scripts/smoke-mcp.mjs`:

```js
  "fabric_score_data_product",
  "fabric_map_data_product_consumers",
  "fabric_validate_data_product_contract",
  "fabric_check_data_product_certification",
  "fabric_generate_data_product_governance_brief",
```

- [ ] **Step 4: Add endpoint verification requirements**

Add the same strings to `missingCritical` in `scripts/verify-endpoints.mjs`.

- [ ] **Step 5: Run verification**

Run:

```powershell
cd C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric
npm test
npm run smoke
npm run verify:endpoints
```

Expected:

- `npm test` passes.
- `npm run smoke` reports 125 MCP tools.
- `npm run verify:endpoints` reports 92 endpoint metadata entries and 125 smoke tools.

- [ ] **Step 6: Commit registry changes**

```powershell
git add src/fabricEndpoints.ts src/fabricEndpoints.test.ts scripts/smoke-mcp.mjs scripts/verify-endpoints.mjs
git commit -m "chore: register data product governance endpoints"
```

Expected: commit succeeds.

---

### Task 5: Add Skill And Workflow Recipe

**Files:**
- Create: `plugins/codex-plugin-fabric/skills/fabric-data-product-governor/SKILL.md`
- Create: `skills/fabric-data-product-governor/SKILL.md`
- Modify: `plugins/codex-plugin-fabric/src/workflowRecipes.ts`
- Modify: `plugins/codex-plugin-fabric/src/workflowRecipes.test.ts`

- [ ] **Step 1: Create plugin skill**

Create `plugins/codex-plugin-fabric/skills/fabric-data-product-governor/SKILL.md`:

```md
---
name: fabric-data-product-governor
description: Assess Microsoft Fabric data products across scorecards, ownership, contracts, consumers, certification readiness, and governance briefs.
---

# Fabric Data Product Governor

Use this skill when a user asks whether a Fabric workspace or item set is ready to be treated as a governed data product.

## Operating Rules

- Keep all checks read-only and evidence-backed.
- Do not write certification state, policies, or Fabric metadata.
- Treat missing owner, failed contract validation, missed SLO, restricted sensitivity, or no-go release gate as certification blockers.

## Workflow

1. Validate contract evidence with `fabric_validate_data_product_contract`.
2. Map consumers with `fabric_map_data_product_consumers`.
3. Score the data product with `fabric_score_data_product`.
4. Check certification readiness with `fabric_check_data_product_certification`.
5. Generate a governance brief with `fabric_generate_data_product_governance_brief`.

## Common Prompts

- "Assess this workspace as a governed data product."
- "Check data product certification readiness."
- "Generate a data product governance brief for this release."
```

- [ ] **Step 2: Create root skill shim**

Create `skills/fabric-data-product-governor/SKILL.md`:

```md
---
name: fabric-data-product-governor
description: Assess Microsoft Fabric data products across scorecards, ownership, contracts, consumers, certification readiness, and governance briefs.
---

# Fabric Data Product Governor

Use this skill when a user asks whether a Fabric workspace or item set is ready to be treated as a governed data product.

## Operating Rules

- Keep all checks read-only and evidence-backed.
- Do not write certification state, policies, or Fabric metadata.
- Treat missing owner, failed contract validation, missed SLO, restricted sensitivity, or no-go release gate as certification blockers.

## Workflow

1. Validate contract evidence with `fabric_validate_data_product_contract`.
2. Map consumers with `fabric_map_data_product_consumers`.
3. Score the data product with `fabric_score_data_product`.
4. Check certification readiness with `fabric_check_data_product_certification`.
5. Generate a governance brief with `fabric_generate_data_product_governance_brief`.

## Common Prompts

- "Assess this workspace as a governed data product."
- "Check data product certification readiness."
- "Generate a data product governance brief for this release."
```

- [ ] **Step 3: Add workflow recipe**

Append this recipe to `WORKFLOW_RECIPES` before the closing array bracket:

```ts
  {
    id: "data-product-governance",
    title: "Fabric Data Product Governance",
    skill: "fabric-data-product-governor",
    goal: "Assess a Fabric workspace or item set as a governed data product across contract, consumers, score, certification readiness, and governance brief.",
    requiredInputs: ["workspaceId or item evidence", "contract evidence", "optional graph", "optional SLO and release gate evidence"],
    tools: [
      "fabric_validate_data_product_contract",
      "fabric_map_data_product_consumers",
      "fabric_score_data_product",
      "fabric_check_data_product_certification",
      "fabric_generate_data_product_governance_brief"
    ],
    outcome: "Data product scorecard, certification readiness decision, and governance brief."
  }
```

- [ ] **Step 4: Add workflow tests**

In `workflow recipes cover specialized skills`, assert:

```ts
  assert.ok(skills.has("fabric-data-product-governor"));
```

Append:

```ts
test("data product governance recipe includes contract and certification tools", () => {
  const recipe = getWorkflowRecipe("data-product-governance");
  assert.ok(recipe);
  const prompt = renderWorkflowPrompt(recipe);

  assert.match(prompt, /fabric-data-product-governor/);
  assert.match(prompt, /fabric_validate_data_product_contract/);
  assert.match(prompt, /fabric_check_data_product_certification/);
});
```

- [ ] **Step 5: Run tests**

```powershell
cd C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit skill and workflow**

```powershell
git add plugins/codex-plugin-fabric/skills/fabric-data-product-governor/SKILL.md skills/fabric-data-product-governor/SKILL.md src/workflowRecipes.ts src/workflowRecipes.test.ts
git commit -m "feat: add data product governor workflow"
```

Expected: commit succeeds.

---

### Task 6: Update Documentation

**Files:**
- Modify: `plugins/codex-plugin-fabric/README.md`
- Modify: `plugins/codex-plugin-fabric/docs/tool-catalog.md`
- Modify: `plugins/codex-plugin-fabric/docs/skills.md`
- Modify: `plugins/codex-plugin-fabric/docs/submission-checklist.md`

- [ ] **Step 1: Update README tool list**

Add these entries to the Enterprise USP layer list:

```md
- `fabric_score_data_product`
- `fabric_map_data_product_consumers`
- `fabric_validate_data_product_contract`
- `fabric_check_data_product_certification`
- `fabric_generate_data_product_governance_brief`
```

Add `fabric-data-product-governor` to the bundled skills list.

- [ ] **Step 2: Update tool catalog**

Add to `docs/tool-catalog.md` under Advanced USP Layer:

```md
### `fabric_score_data_product`

Scores a Fabric workspace or item set as a governed data product from ownership, contract, sensitivity, SLO, drift, release, criticality, and impact evidence.

### `fabric_map_data_product_consumers`

Maps downstream and explicit consumers for a Fabric data product from graph and operator-supplied consumer evidence.

### `fabric_validate_data_product_contract`

Validates Fabric data product contract evidence and detects missing terms or breaking-change signals.

### `fabric_check_data_product_certification`

Evaluates data product certification readiness without writing certification state.

### `fabric_generate_data_product_governance_brief`

Generates a concise governance brief for Fabric data owners, platform teams, and change boards.
```

- [ ] **Step 3: Update skills doc**

Add to `docs/skills.md`:

```md
## `fabric-data-product-governor`

Data product governance workflow for scorecards, ownership, contracts, consumers, certification readiness, and governance briefs.
```

- [ ] **Step 4: Update checklist**

Add to `docs/submission-checklist.md`:

```md
- [x] Data-product-governor skill exposes scorecard, contract, consumer, certification, and governance brief workflows
```

- [ ] **Step 5: Run documentation-sensitive validation**

```powershell
cd C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric
npm run verify:marketplace
npm run export:tool-metadata
npm run evidence:package
```

Expected: all commands pass.

- [ ] **Step 6: Commit docs**

```powershell
git add README.md docs/tool-catalog.md docs/skills.md docs/submission-checklist.md
git commit -m "docs: document data product governance"
```

Expected: commit succeeds.

---

### Task 7: Final Verification

**Files:**
- No new file edits unless a command reports a concrete issue.

- [ ] **Step 1: Run full local verification**

```powershell
cd C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric
npm test
npm run smoke
npm run verify:endpoints
npm run verify:marketplace
npm run export:tool-metadata
npm run evidence:package
```

Expected:

- Tests pass.
- MCP smoke reports 125 tools.
- Endpoint verification reports 92 endpoint metadata entries and 125 smoke tools.
- Marketplace verification passes.
- Tool metadata exports to `plugins/codex-plugin-fabric/generated`.
- Evidence package exports to `plugins/codex-plugin-fabric/generated/evidence`.

- [ ] **Step 2: Check git status**

```powershell
cd C:\tmp\Codex-Plugin-Fabric
git status --short
```

Expected: only intended project changes remain. Existing unrelated dirty files may still appear and must not be reverted.

- [ ] **Step 3: Report remaining live-gate limitation**

Final report must state:

```text
verify:all still requires real Fabric Non-Prod environment variables for live smoke.
```

Do not claim live Fabric validation unless `npm run verify:all` was run with real `FABRIC_TEST_*` values and passed.

---

## Self-Review Notes

- Spec coverage: The plan covers all five new MCP tools, pure logic, registry, smoke, workflow, skill, docs, tests, and verification.
- Marker scan: No unresolved implementation markers are present.
- Type consistency: Function names match the design spec and tool names. Tool outputs use existing JSON object patterns and `safeTool`.
- Scope check: This plan implements only B Data Product Governance. A Autonomous Operations and C FinOps/Capacity Intelligence need separate specs and plans after this implementation.
