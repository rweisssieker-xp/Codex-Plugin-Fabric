import { createHash } from "node:crypto";
import {
  LearnedLesson,
  LearningEvent,
  LearningSnapshot,
  RiskObservation,
  TaskMemory
} from "./learningStore.js";
import { redact } from "./redaction.js";

export interface SimilarTaskQuery {
  taskGoal: string;
  taskType?: string;
  environmentLabel?: string;
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  limit?: number;
}

export interface SimilarTaskResult {
  memory: TaskMemory;
  score: number;
  reasons: string[];
}

export interface RecommendationInput extends SimilarTaskQuery {
  similarTasks: SimilarTaskResult[];
  lessons: LearnedLesson[];
}

export interface NextTaskRecommendation {
  taskGoal: string;
  confidence: number;
  steps: string[];
  guardrails: string[];
  evidence: string[];
  warnings: string[];
}

export interface LearningPatternReport {
  generatedAt: string;
  repeatedIssues: Array<{ key: string; count: number; severity: string; examples: string[] }>;
  repeatedTaskFailures: Array<{ key: string; count: number; lessons: string[] }>;
  highRiskScopes: Array<{ scope: string; count: number; reasons: string[] }>;
  acceptedRecommendations: number;
}

export interface PolicyImprovementSuggestion {
  field: string;
  suggestion: string;
  confidence: number;
  evidenceCount: number;
  rationale: string;
}

export interface LearnedPlaybookInput {
  name: string;
  taskGoal: string;
  lessons: LearnedLesson[];
  similarTasks: SimilarTaskResult[];
}

export interface GeneratedLearnedPlaybook {
  name: string;
  markdown: string;
  steps: string[];
  confidence: number;
  sourceLessonIds: string[];
}

export interface LearningEvidence {
  exportedAt: string;
  checksum: string;
  counts: Record<string, number>;
  lessons: LearnedLesson[];
  playbooks: unknown[];
  riskObservations: RiskObservation[];
}

const BASE_GUARDRAIL = "Do not bypass confirm, expected target binding, preflight, or allowProduction requirements.";

export function findSimilarTaskMemories(memories: TaskMemory[], query: SimilarTaskQuery): SimilarTaskResult[] {
  const terms = tokenize(query.taskGoal);
  return memories
    .map((memory) => {
      const reasons: string[] = [];
      let score = 0;
      if (query.workspaceId && memory.workspaceId === query.workspaceId) {
        score += 5;
        reasons.push("same workspace");
      }
      if (query.environmentLabel && memory.environmentLabel?.toLowerCase() === query.environmentLabel.toLowerCase()) {
        score += 4;
        reasons.push("same environment");
      }
      if (query.taskType && memory.taskType === query.taskType) {
        score += 3;
        reasons.push("same task type");
      }
      if (query.itemId && memory.itemId === query.itemId) {
        score += 3;
        reasons.push("same item");
      }
      if (query.pipelineId && memory.pipelineId === query.pipelineId) {
        score += 3;
        reasons.push("same pipeline");
      }
      const memoryTerms = tokenize(`${memory.taskGoal} ${memory.lesson ?? ""} ${memory.planSummary ?? ""}`);
      const overlap = [...terms].filter((term) => memoryTerms.has(term)).length;
      if (overlap > 0) {
        score += overlap;
        reasons.push(`${overlap} matching goal terms`);
      }
      if (memory.outcome === "success") score += 1;
      if (memory.outcome === "blocked" || memory.outcome === "failed") score += 0.5;
      score += memory.confidence;
      return { memory, score, reasons };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, query.limit ?? 10);
}

export function recommendNextTaskSteps(input: RecommendationInput): NextTaskRecommendation {
  const steps = new Set<string>();
  const evidence: string[] = [];
  const warnings: string[] = [];

  for (const result of input.similarTasks.slice(0, 5)) {
    for (const tool of result.memory.toolsUsed) steps.add(tool);
    if (result.memory.lesson) evidence.push(result.memory.lesson);
    if (result.memory.outcome === "blocked" || result.memory.outcome === "failed") {
      warnings.push(`Prior ${result.memory.outcome} task: ${result.memory.lesson ?? result.memory.taskGoal}`);
    }
  }

  for (const lesson of input.lessons) {
    if (lesson.recommendation) evidence.push(lesson.recommendation);
  }

  if (input.taskType === "deployment" || /deploy|release|prod/i.test(input.taskGoal)) {
    steps.add("fabric_git_get_status");
    steps.add("fabric_build_dependency_graph");
    steps.add("fabric_analyze_blast_radius");
    steps.add("fabric_deployment_preflight");
  }
  if (/incident|failed|error|diagnose/i.test(input.taskGoal)) {
    steps.add("fabric_diagnose_failed_run");
    steps.add("fabric_correlate_incident");
    steps.add("fabric_generate_recovery_plan");
  }
  if (steps.size === 0) {
    steps.add("fabric_workspace_snapshot");
    steps.add("fabric_analyze_learning_patterns");
  }

  const confidence = clamp(
    input.similarTasks.reduce((sum, result) => sum + Math.min(result.score / 10, 1), 0) / Math.max(input.similarTasks.length, 1)
  );

  return {
    taskGoal: input.taskGoal,
    confidence,
    steps: [...steps],
    guardrails: [BASE_GUARDRAIL, "Treat learned playbooks as advisory until existing Fabric guardrails pass."],
    evidence: unique(evidence).slice(0, 10),
    warnings: unique(warnings).slice(0, 10)
  };
}

export function analyzeLearningPatterns(snapshot: LearningSnapshot): LearningPatternReport {
  const issues = new Map<string, { count: number; severity: string; examples: string[] }>();
  for (const event of snapshot.learningEvents) {
    const key = `${event.category}:${event.summary}`;
    const current = issues.get(key) ?? { count: 0, severity: event.severity, examples: [] };
    current.count += 1;
    current.severity = higherSeverity(current.severity, event.severity);
    current.examples.push(event.toolName ?? event.source);
    issues.set(key, current);
  }

  const taskFailures = new Map<string, { count: number; lessons: string[] }>();
  for (const memory of snapshot.taskMemories.filter((entry) => entry.outcome === "blocked" || entry.outcome === "failed")) {
    const key = `${memory.taskType ?? "task"}:${memory.environmentLabel ?? "unknown"}`;
    const current = taskFailures.get(key) ?? { count: 0, lessons: [] };
    current.count += 1;
    if (memory.lesson) current.lessons.push(memory.lesson);
    taskFailures.set(key, current);
  }

  const highRisk = new Map<string, { count: number; reasons: string[] }>();
  for (const risk of snapshot.riskObservations.filter((entry) => entry.riskLevel === "high" || entry.riskLevel === "critical")) {
    const scope = risk.workspaceId ?? risk.pipelineId ?? risk.itemId ?? "global";
    const current = highRisk.get(scope) ?? { count: 0, reasons: [] };
    current.count += 1;
    current.reasons.push(risk.reason);
    highRisk.set(scope, current);
  }

  return {
    generatedAt: new Date().toISOString(),
    repeatedIssues: [...issues.entries()]
      .map(([key, value]) => ({ key, count: value.count, severity: value.severity, examples: unique(value.examples).slice(0, 5) }))
      .filter((entry) => entry.count > 1 || entry.severity === "high" || entry.severity === "critical")
      .sort((left, right) => right.count - left.count),
    repeatedTaskFailures: [...taskFailures.entries()]
      .map(([key, value]) => ({ key, count: value.count, lessons: unique(value.lessons).slice(0, 5) }))
      .sort((left, right) => right.count - left.count),
    highRiskScopes: [...highRisk.entries()]
      .map(([scope, value]) => ({ scope, count: value.count, reasons: unique(value.reasons).slice(0, 5) }))
      .sort((left, right) => right.count - left.count),
    acceptedRecommendations: snapshot.operatorFeedback.filter((entry) => entry.accepted || entry.rating === "accepted" || entry.rating === "helpful").length
  };
}

export function suggestPolicyImprovements(snapshot: LearningSnapshot, minConfidence: number): PolicyImprovementSuggestion[] {
  const suggestions: PolicyImprovementSuggestion[] = [];
  const deploymentBlocks = snapshot.taskMemories.filter(
    (entry) => entry.taskType === "deployment" && (entry.outcome === "blocked" || entry.outcome === "failed") && /git/i.test(`${entry.lesson ?? ""} ${entry.planSummary ?? ""}`)
  );
  if (deploymentBlocks.length >= 2) {
    const confidence = clamp(0.45 + deploymentBlocks.length * 0.1);
    if (confidence >= minConfidence) {
      suggestions.push({
        field: "requireCleanGitBeforeDeployment",
        suggestion: "Set requireCleanGitBeforeDeployment to true for deployment workflows.",
        confidence,
        evidenceCount: deploymentBlocks.length,
        rationale: "Repeated deployment task memories mention Git drift, Git status, or Git blockers."
      });
    }
  }

  const productionRisks = snapshot.riskObservations.filter((entry) => (entry.riskLevel === "high" || entry.riskLevel === "critical") && /prod|production/i.test(entry.reason));
  if (productionRisks.length >= 1) {
    const confidence = clamp(0.55 + productionRisks.length * 0.1);
    if (confidence >= minConfidence) {
      suggestions.push({
        field: "requirePreflightForProduction",
        suggestion: "Keep requirePreflightForProduction enabled and require evidence before production-like actions.",
        confidence,
        evidenceCount: productionRisks.length,
        rationale: "High-risk observations include production-like scope."
      });
    }
  }

  return suggestions.sort((left, right) => right.confidence - left.confidence);
}

export function generateLearnedPlaybook(input: LearnedPlaybookInput): GeneratedLearnedPlaybook {
  const steps = new Set<string>();
  for (const result of input.similarTasks) {
    for (const tool of result.memory.toolsUsed) steps.add(tool);
  }
  if (/deploy|release|prod/i.test(input.taskGoal)) {
    steps.add("fabric_git_get_status");
    steps.add("fabric_deployment_preflight");
    steps.add("fabric_analyze_blast_radius");
  }
  steps.add("fabric_generate_runbook");
  const finalSteps = [...steps];
  const sourceLessonIds = input.lessons.map((lesson) => lesson.id);
  const confidence = clamp((input.lessons.reduce((sum, lesson) => sum + lesson.confidence, 0) + input.similarTasks.length * 0.5) / Math.max(input.lessons.length + input.similarTasks.length, 1));
  return {
    name: input.name,
    steps: finalSteps,
    confidence,
    sourceLessonIds,
    markdown: [
      `# ${input.name}`,
      "",
      `Goal: ${input.taskGoal}`,
      "",
      "## Steps",
      ...finalSteps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "## Guardrails",
      `- ${BASE_GUARDRAIL}`
    ].join("\n")
  };
}

export function exportLearningEvidence(snapshot: LearningSnapshot): LearningEvidence {
  const evidence = {
    exportedAt: new Date().toISOString(),
    counts: {
      taskMemories: snapshot.taskMemories.length,
      learningEvents: snapshot.learningEvents.length,
      operatorFeedback: snapshot.operatorFeedback.length,
      learnedLessons: snapshot.learnedLessons.length,
      learnedPlaybooks: snapshot.learnedPlaybooks.length,
      riskObservations: snapshot.riskObservations.length
    },
    lessons: snapshot.learnedLessons,
    playbooks: snapshot.learnedPlaybooks,
    riskObservations: snapshot.riskObservations
  };
  return {
    ...(redact(evidence) as Omit<LearningEvidence, "checksum">),
    checksum: createHash("sha256").update(JSON.stringify(evidence)).digest("hex")
  };
}

export function deriveLessonsFromSnapshot(snapshot: LearningSnapshot): LearnedLesson[] {
  const lessons = new Map<string, LearnedLesson>();
  for (const memory of snapshot.taskMemories) {
    if (!memory.lesson) continue;
    const scopeKey = [memory.environmentLabel, memory.workspaceId, memory.taskType].filter(Boolean).join(":") || "global";
    const key = `${scopeKey}:${memory.lesson}`;
    const existing = lessons.get(key);
    const now = memory.updatedAt;
    lessons.set(key, {
      id: existing?.id ?? memory.hash.slice(0, 16),
      createdAt: existing?.createdAt ?? memory.createdAt,
      updatedAt: now,
      lessonType: memory.taskType ?? "task",
      scopeKey,
      title: memory.lesson,
      summary: memory.planSummary ?? memory.taskGoal,
      confidence: clamp((existing?.confidence ?? 0) + memory.confidence / 2),
      evidenceCount: (existing?.evidenceCount ?? 0) + 1,
      lastEvidenceAt: now,
      recommendation: memory.doNextTime?.join("; "),
      payload: { evidenceRefs: memory.evidenceRefs }
    });
  }
  return [...lessons.values()].sort((left, right) => right.confidence - left.confidence);
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function higherSeverity(left: string, right: LearningEvent["severity"]): string {
  const order = ["low", "medium", "high", "critical"];
  return order.indexOf(right) > order.indexOf(left) ? right : left;
}
