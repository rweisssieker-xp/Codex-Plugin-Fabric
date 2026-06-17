import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  analyzeLearningPatterns,
  exportLearningEvidence,
  findSimilarTaskMemories,
  generateLearnedPlaybook,
  recommendNextTaskSteps,
  suggestPolicyImprovements
} from "./learning.js";
import { LearningSnapshot, LearningStore, TaskMemory } from "./learningStore.js";

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

  assert.equal(memory.payload?.Authorization, "[REDACTED]");
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

test("task memories without outcome or lesson are low confidence and incomplete", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fabric-learning-"));
  const store = new LearningStore(dir);
  const memory = await store.recordTaskMemory({ taskGoal: "Investigate deployment" });

  assert.equal(memory.incomplete, true);
  assert.equal(memory.outcome, "unknown");
  assert.ok(memory.confidence <= 0.3);
});

test("similar task lookup ranks exact workspace and environment first", () => {
  const results = findSimilarTaskMemories([
    {
      id: "a",
      createdAt: "2026-06-17T00:00:00.000Z",
      updatedAt: "2026-06-17T00:00:00.000Z",
      taskGoal: "Deploy model",
      taskType: "deployment",
      environmentLabel: "prod",
      workspaceId: "w1",
      outcome: "blocked",
      lesson: "Run Git status first.",
      toolsUsed: ["fabric_git_get_status"],
      assumptions: [],
      decisions: [],
      doNextTime: [],
      avoidNextTime: [],
      evidenceRefs: [],
      confidence: 0.8,
      hash: "a",
      incomplete: false
    },
    {
      id: "b",
      createdAt: "2026-06-17T00:00:00.000Z",
      updatedAt: "2026-06-17T00:00:00.000Z",
      taskGoal: "Deploy model",
      taskType: "deployment",
      environmentLabel: "test",
      workspaceId: "w2",
      outcome: "success",
      lesson: "Run preflight.",
      toolsUsed: ["fabric_deployment_preflight"],
      assumptions: [],
      decisions: [],
      doNextTime: [],
      avoidNextTime: [],
      evidenceRefs: [],
      confidence: 0.6,
      hash: "b",
      incomplete: false
    }
  ], { taskGoal: "Deploy semantic model", taskType: "deployment", environmentLabel: "prod", workspaceId: "w1" });

  assert.equal(results[0].memory.id, "a");
  assert.ok(results[0].score > results[1].score);
});

test("next-step recommendations preserve guardrails", () => {
  const recommendation = recommendNextTaskSteps({
    taskGoal: "Prod deploy",
    taskType: "deployment",
    environmentLabel: "prod",
    similarTasks: [{
      memory: taskMemory({ id: "a", toolsUsed: ["fabric_git_get_status"], lesson: "Git drift blocked deployment.", confidence: 0.9 }),
      score: 5,
      reasons: ["same environment"]
    }],
    lessons: []
  });

  assert.ok(recommendation.steps.includes("fabric_deployment_preflight"));
  assert.ok(recommendation.guardrails.includes("Do not bypass confirm, expected target binding, preflight, or allowProduction requirements."));
});

test("learning patterns rank repeated issues and task failures", () => {
  const report = analyzeLearningPatterns(snapshot({
    learningEvents: [
      { id: "e1", timestamp: "2026-06-17T00:00:00.000Z", source: "diagnostic", category: "Permission", severity: "high", summary: "Missing role", hash: "e1" },
      { id: "e2", timestamp: "2026-06-17T00:01:00.000Z", source: "diagnostic", category: "Permission", severity: "medium", summary: "Missing role", hash: "e2" }
    ],
    taskMemories: [taskMemory({ id: "t1", outcome: "failed", lesson: "Preflight first." })]
  }));

  assert.equal(report.repeatedIssues[0].key, "Permission:Missing role");
  assert.equal(report.repeatedTaskFailures[0].count, 1);
});

test("policy suggestions are advisory and based on repeated task memories", () => {
  const suggestions = suggestPolicyImprovements(snapshot({
    taskMemories: [
      taskMemory({ id: "a", taskType: "deployment", outcome: "blocked", lesson: "Git drift blocked deployment." }),
      taskMemory({ id: "b", taskType: "deployment", outcome: "failed", lesson: "Git status was dirty." })
    ]
  }), 0.5);

  assert.equal(suggestions[0].field, "requireCleanGitBeforeDeployment");
  assert.match(suggestions[0].suggestion, /requireCleanGitBeforeDeployment/);
});

test("generated learned playbook includes guardrails and source lessons", () => {
  const playbook = generateLearnedPlaybook({
    name: "Prod deployment playbook",
    taskGoal: "Deploy to prod",
    lessons: [{
      id: "lesson-1",
      createdAt: "2026-06-17T00:00:00.000Z",
      updatedAt: "2026-06-17T00:00:00.000Z",
      lessonType: "deployment",
      scopeKey: "prod",
      title: "Check Git first",
      summary: "Git drift blocked deployment.",
      confidence: 0.9,
      evidenceCount: 2
    }],
    similarTasks: []
  });

  assert.ok(playbook.steps.includes("fabric_deployment_preflight"));
  assert.deepEqual(playbook.sourceLessonIds, ["lesson-1"]);
  assert.match(playbook.markdown, /Do not bypass confirm/);
});

test("learning evidence export redacts secrets and includes checksum", () => {
  const evidence = exportLearningEvidence(snapshot({
    learnedLessons: [{
      id: "lesson-1",
      createdAt: "2026-06-17T00:00:00.000Z",
      updatedAt: "2026-06-17T00:00:00.000Z",
      lessonType: "diagnostic",
      scopeKey: "global",
      title: "Never store token",
      summary: "Token was redacted.",
      confidence: 1,
      evidenceCount: 1,
      payload: { accessToken: "secret" }
    }]
  }));

  assert.equal(evidence.lessons[0].payload?.accessToken, "[REDACTED]");
  assert.ok(evidence.checksum.length > 20);
});

function taskMemory(overrides: Partial<TaskMemory> = {}): TaskMemory {
  return {
    id: "task",
    createdAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:00:00.000Z",
    taskGoal: "Deploy model",
    taskType: "deployment",
    environmentLabel: "prod",
    workspaceId: "workspace",
    toolsUsed: ["fabric_git_get_status"],
    assumptions: [],
    decisions: [],
    outcome: "blocked",
    lesson: "Check Git first.",
    doNextTime: ["Run Git status."],
    avoidNextTime: [],
    evidenceRefs: [],
    confidence: 0.8,
    hash: "hash",
    incomplete: false,
    ...overrides
  };
}

function snapshot(overrides: Partial<LearningSnapshot>): LearningSnapshot {
  return {
    taskMemories: [],
    learningEvents: [],
    operatorFeedback: [],
    learnedLessons: [],
    learnedPlaybooks: [],
    riskObservations: [],
    exportedAt: "2026-06-17T00:00:00.000Z",
    checksum: "checksum",
    ...overrides
  };
}
