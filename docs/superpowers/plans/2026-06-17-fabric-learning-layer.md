# Fabric Learning Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed self-learning layer that records local task memories, tool events, feedback, lessons, playbooks, risk observations, pattern analysis, policy suggestions, and evidence export.

**Architecture:** Use a local file-backed learning store under the existing Fabric plugin state directory. The public interface is a deterministic learning service plus MCP tools; the store redacts payloads, enforces size limits, and never mutates Fabric or policy files.

**Tech Stack:** TypeScript, Node.js 20, MCP SDK, Zod, node:test, local JSON-backed persistence with a SQLite-ready repository boundary.

---

## File Structure

- Create `plugins/codex-plugin-fabric/src/learningStore.ts`
  - Local durable repository for task memories, learning events, feedback, lessons, playbooks, and risk observations.
  - Uses a JSON document file in V1 with a stable repository interface so SQLite can replace the backend later without changing tools.

- Create `plugins/codex-plugin-fabric/src/learning.ts`
  - Deterministic scoring, lesson generation, similar-task matching, next-step recommendation, policy suggestions, and evidence export.

- Create `plugins/codex-plugin-fabric/src/learning.test.ts`
  - Covers redaction, size limits, task memory, similar matching, recommendations, patterns, policy suggestions, and evidence export.

- Create `plugins/codex-plugin-fabric/src/tools/learning.ts`
  - Registers MCP tools for the learning layer.

- Modify `plugins/codex-plugin-fabric/src/tools/context.ts`
  - Adds `learning` store to `ToolContext`.

- Modify `plugins/codex-plugin-fabric/src/server.ts`
  - Instantiates `LearningStore` and registers learning tools.

- Modify `plugins/codex-plugin-fabric/src/policy.ts`
  - Adds learning policy fields with safe defaults.

- Modify `plugins/codex-plugin-fabric/fabric-policy.example.json`
  - Documents learning policy knobs.

- Modify `plugins/codex-plugin-fabric/src/fabricEndpoints.ts`
  - Adds local endpoint metadata for learning tools.

- Modify `plugins/codex-plugin-fabric/scripts/smoke-mcp.mjs`
  - Expects learning tools in MCP smoke.

- Modify docs under `plugins/codex-plugin-fabric/docs`
  - Tool catalog, operator guide, security governance, roadmap, changelog.

## Tasks

### Task 1: Learning Store

**Files:**
- Create: `plugins/codex-plugin-fabric/src/learningStore.ts`
- Test: `plugins/codex-plugin-fabric/src/learning.test.ts`

- [ ] **Step 1: Write tests for persistence, redaction, and payload limits**

```ts
test("learning store records redacted task memories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fabric-learning-"));
  const store = new LearningStore(dir, { maxPayloadBytes: 4096 });
  const memory = await store.recordTaskMemory({
    taskGoal: "Deploy semantic model",
    taskType: "deployment",
    environmentLabel: "prod",
    workspaceId: "11111111-1111-1111-1111-111111111111",
    toolsUsed: ["fabric_git_get_status"],
    outcome: "blocked",
    lesson: "Check Git status before deployment.",
    payload: { Authorization: "Bearer secret" }
  });

  assert.equal(memory.payload.Authorization, "[REDACTED]");
  assert.equal((await store.getStatus()).counts.taskMemories, 1);
});

test("learning store rejects oversized payloads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fabric-learning-"));
  const store = new LearningStore(dir, { maxPayloadBytes: 64 });
  await assert.rejects(
    () => store.recordLearningEvent({ source: "test", category: "diagnostic", severity: "medium", summary: "x", payload: { text: "x".repeat(500) } }),
    /Learning payload exceeds/
  );
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm run build && node --test dist/learning.test.js`
Expected: FAIL because `learningStore.ts` does not exist.

- [ ] **Step 3: Implement `LearningStore`**

```ts
export class LearningStore {
  constructor(stateDir: string, options?: { maxPayloadBytes?: number });
  getStatus(): Promise<LearningStatus>;
  recordTaskMemory(input: RecordTaskMemoryInput): Promise<TaskMemory>;
  recordLearningEvent(input: RecordLearningEventInput): Promise<LearningEvent>;
  recordOperatorFeedback(input: RecordOperatorFeedbackInput): Promise<OperatorFeedback>;
  listTaskMemories(filter?: LearningFilter): Promise<TaskMemory[]>;
  listLearningEvents(filter?: LearningFilter): Promise<LearningEvent[]>;
  listFeedback(): Promise<OperatorFeedback[]>;
  upsertLesson(input: UpsertLessonInput): Promise<LearnedLesson>;
  listLessons(filter?: LessonFilter): Promise<LearnedLesson[]>;
  upsertPlaybook(input: UpsertPlaybookInput): Promise<LearnedPlaybook>;
  listPlaybooks(): Promise<LearnedPlaybook[]>;
  recordRiskObservation(input: RecordRiskObservationInput): Promise<RiskObservation>;
  exportSnapshot(): Promise<LearningSnapshot>;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run build && node --test dist/learning.test.js`
Expected: PASS for store tests.

### Task 2: Deterministic Learning Logic

**Files:**
- Create: `plugins/codex-plugin-fabric/src/learning.ts`
- Modify: `plugins/codex-plugin-fabric/src/learning.test.ts`

- [ ] **Step 1: Write tests for similar task matching and recommendations**

```ts
test("similar task lookup ranks exact workspace and environment first", () => {
  const results = findSimilarTaskMemories([
    { id: "a", taskGoal: "Deploy model", taskType: "deployment", environmentLabel: "prod", workspaceId: "w1", outcome: "blocked", lesson: "Run Git status first.", toolsUsed: ["fabric_git_get_status"], confidence: 0.8 },
    { id: "b", taskGoal: "Deploy model", taskType: "deployment", environmentLabel: "test", workspaceId: "w2", outcome: "success", lesson: "Run preflight.", toolsUsed: ["fabric_deployment_preflight"], confidence: 0.6 }
  ] as TaskMemory[], { taskGoal: "Deploy semantic model", taskType: "deployment", environmentLabel: "prod", workspaceId: "w1" });

  assert.equal(results[0].memory.id, "a");
  assert.ok(results[0].score > results[1].score);
});

test("next-step recommendations preserve guardrails", () => {
  const recommendation = recommendNextTaskSteps({
    taskGoal: "Prod deploy",
    taskType: "deployment",
    environmentLabel: "prod",
    similarTasks: [{ memory: { id: "a", toolsUsed: ["fabric_git_get_status"], lesson: "Git drift blocked deployment.", confidence: 0.9 } as TaskMemory, score: 5 }],
    lessons: []
  });

  assert.ok(recommendation.steps.includes("fabric_deployment_preflight"));
  assert.ok(recommendation.guardrails.includes("Do not bypass confirm, expected target binding, preflight, or allowProduction requirements."));
});
```

- [ ] **Step 2: Implement learning helpers**

Implement:

```ts
export function findSimilarTaskMemories(memories: TaskMemory[], query: SimilarTaskQuery): SimilarTaskResult[];
export function recommendNextTaskSteps(input: RecommendationInput): NextTaskRecommendation;
export function analyzeLearningPatterns(snapshot: LearningSnapshot): LearningPatternReport;
export function suggestPolicyImprovements(snapshot: LearningSnapshot, minConfidence: number): PolicyImprovementSuggestion[];
export function generateLearnedPlaybook(input: LearnedPlaybookInput): GeneratedLearnedPlaybook;
export function exportLearningEvidence(snapshot: LearningSnapshot): LearningEvidence;
```

- [ ] **Step 3: Run tests**

Run: `npm run build && node --test dist/learning.test.js`
Expected: PASS.

### Task 3: Policy and Context Integration

**Files:**
- Modify: `plugins/codex-plugin-fabric/src/policy.ts`
- Modify: `plugins/codex-plugin-fabric/src/tools/context.ts`
- Modify: `plugins/codex-plugin-fabric/src/server.ts`
- Modify: `plugins/codex-plugin-fabric/fabric-policy.example.json`

- [ ] **Step 1: Add policy fields**

Add to `FabricPolicy` and `DEFAULT_POLICY`:

```ts
allowLocalLearning: boolean;
maxLearningPayloadBytes: number;
learningRetentionDays: number;
allowLearningEvidenceExport: boolean;
minLessonConfidenceForPolicySuggestions: number;
allowTaskMemory: boolean;
allowAutomaticTaskSummaryMemory: boolean;
maxTaskMemoryPayloadBytes: number;
```

Defaults:

```ts
allowLocalLearning: true,
maxLearningPayloadBytes: 65536,
learningRetentionDays: 0,
allowLearningEvidenceExport: true,
minLessonConfidenceForPolicySuggestions: 0.5,
allowTaskMemory: true,
allowAutomaticTaskSummaryMemory: true,
maxTaskMemoryPayloadBytes: 65536
```

- [ ] **Step 2: Add `learning` to ToolContext and server**

Instantiate:

```ts
const policyStore = new PolicyStore(config);
const policy = await policyStore.load();
const context: ToolContext = {
  client,
  audit: new AuditLog(config.auditLogPath),
  state: new LocalState(config.stateDir),
  policy: policyStore,
  learning: new LearningStore(config.stateDir, { maxPayloadBytes: policy.maxLearningPayloadBytes })
};
```

- [ ] **Step 3: Run policy tests**

Run: `npm run build && node --test dist/policy.test.js dist/learning.test.js`
Expected: PASS.

### Task 4: MCP Learning Tools

**Files:**
- Create: `plugins/codex-plugin-fabric/src/tools/learning.ts`
- Modify: `plugins/codex-plugin-fabric/src/server.ts`
- Modify: `plugins/codex-plugin-fabric/scripts/smoke-mcp.mjs`
- Modify: `plugins/codex-plugin-fabric/src/fabricEndpoints.ts`

- [ ] **Step 1: Implement MCP tools**

Register:

```ts
fabric_get_learning_status
fabric_record_learning_event
fabric_record_task_memory
fabric_find_similar_task_memories
fabric_recommend_next_task_steps
fabric_record_operator_feedback
fabric_list_learned_lessons
fabric_analyze_learning_patterns
fabric_generate_learned_playbook
fabric_suggest_policy_improvements
fabric_export_learning_evidence
```

Each tool must:

- use `safeTool`
- check `policy.allowLocalLearning` for writes and reads
- check `policy.allowTaskMemory` for task-memory tools
- check `policy.allowLearningEvidenceExport` before export
- return advisory text and never write policy files or call Fabric APIs

- [ ] **Step 2: Register tools in server and smoke**

Add `registerLearningTools(server, context);`.

Add all tool names to `expectedTools`.

Add local endpoint metadata group `learning`.

- [ ] **Step 3: Run smoke**

Run: `npm run smoke`
Expected: MCP smoke passes with increased tool count.

### Task 5: Documentation and Verification

**Files:**
- Modify: `plugins/codex-plugin-fabric/docs/tool-catalog.md`
- Modify: `plugins/codex-plugin-fabric/docs/operator-guide.md`
- Modify: `plugins/codex-plugin-fabric/docs/security-governance.md`
- Modify: `plugins/codex-plugin-fabric/docs/roadmap.md`
- Modify: `plugins/codex-plugin-fabric/docs/changelog.md`

- [ ] **Step 1: Document Learning Layer**

Add concise sections explaining:

- local task memories
- no full chat transcript storage
- redaction and size limits
- advisory-only recommendations
- how to record feedback and task lessons

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run verify:all
npm run export:tool-metadata
npm run evidence:package
python "C:\Users\weiss\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "C:\tmp\Codex-Plugin-Fabric"
python "C:\Users\weiss\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "C:\tmp\Codex-Plugin-Fabric\plugins\codex-plugin-fabric"
```

Expected:

- tests pass
- smoke passes
- audit has 0 vulnerabilities
- marketplace verification passes
- endpoint verification passes
- live smoke skips without env vars
- root and nested plugin validators pass

## Self-Review

- Spec coverage: task memory, tool usage learning, feedback learning, lessons, playbooks, policy suggestions, evidence export, redaction, and advisory-only behavior are covered.
- Placeholder scan: no placeholder steps remain.
- Type consistency: all tool names and policy field names match the design document.
