import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  analyzeLearningPatterns,
  deriveLessonsFromSnapshot,
  exportLearningEvidence,
  findSimilarTaskMemories,
  generateLearnedPlaybook,
  recommendNextTaskSteps,
  suggestPolicyImprovements
} from "../learning.js";
import { TaskOutcome } from "../learningStore.js";
import { ToolContext } from "./context.js";
import { safeTool } from "./toolUtils.js";

const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
const OutcomeSchema = z.enum(["success", "blocked", "failed", "partial", "unknown"]);
const FeedbackRatingSchema = z.enum(["helpful", "wrong", "accepted", "rejected", "neutral"]);
const OptionalPayloadSchema = z.record(z.unknown()).optional();

export function registerLearningTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_get_learning_status",
    "Show local governed-learning status, storage path, record counts, and last learning activity.",
    {},
    () => safeTool(async () => {
      const policy = await context.policy.load();
      if (!policy.allowLocalLearning) return { enabled: false, reason: "Policy allowLocalLearning is false." };
      return context.learning.getStatus();
    })
  );

  server.tool(
    "fabric_record_learning_event",
    "Record a redacted local learning event from diagnostics, preflight, deployment review, or operator context.",
    {
      source: z.string().min(1),
      toolName: z.string().min(1).optional(),
      workspaceId: z.string().optional(),
      itemId: z.string().optional(),
      pipelineId: z.string().optional(),
      environmentLabel: z.string().optional(),
      category: z.string().min(1),
      severity: SeveritySchema.optional(),
      summary: z.string().min(1),
      payload: OptionalPayloadSchema
    },
    (input) => safeTool(async () => {
      await requireLearningEnabled(context);
      return context.learning.recordLearningEvent(input);
    })
  );

  server.tool(
    "fabric_record_task_memory",
    "Record a structured task memory with goal, plan, tool sequence, decisions, outcome, lesson, and next-time guidance.",
    {
      taskGoal: z.string().min(1),
      taskType: z.string().optional(),
      environmentLabel: z.string().optional(),
      workspaceId: z.string().optional(),
      itemId: z.string().optional(),
      pipelineId: z.string().optional(),
      planSummary: z.string().optional(),
      toolsUsed: z.array(z.string().min(1)).optional(),
      assumptions: z.array(z.string().min(1)).optional(),
      decisions: z.array(z.string().min(1)).optional(),
      outcome: OutcomeSchema.optional(),
      lesson: z.string().optional(),
      doNextTime: z.array(z.string().min(1)).optional(),
      avoidNextTime: z.array(z.string().min(1)).optional(),
      confidence: z.number().min(0).max(1).optional(),
      evidenceRefs: z.array(z.string().min(1)).optional(),
      payload: OptionalPayloadSchema
    },
    (input) => safeTool(async () => {
      await requireTaskMemoryEnabled(context);
      return context.learning.recordTaskMemory({ ...input, outcome: input.outcome as TaskOutcome | undefined });
    })
  );

  server.tool(
    "fabric_find_similar_task_memories",
    "Find prior structured task memories similar to a new Fabric task goal.",
    {
      taskGoal: z.string().min(1),
      taskType: z.string().optional(),
      environmentLabel: z.string().optional(),
      workspaceId: z.string().optional(),
      itemId: z.string().optional(),
      pipelineId: z.string().optional(),
      limit: z.number().int().positive().max(50).optional()
    },
    (input) => safeTool(async () => {
      await requireTaskMemoryEnabled(context);
      const memories = await context.learning.listTaskMemories({ limit: 500 });
      return findSimilarTaskMemories(memories, input);
    })
  );

  server.tool(
    "fabric_recommend_next_task_steps",
    "Recommend the next safe tool sequence using similar task memories, learned lessons, policy signals, and known risks.",
    {
      taskGoal: z.string().min(1),
      taskType: z.string().optional(),
      environmentLabel: z.string().optional(),
      workspaceId: z.string().optional(),
      itemId: z.string().optional(),
      pipelineId: z.string().optional()
    },
    (input) => safeTool(async () => {
      await requireTaskMemoryEnabled(context);
      const [memories, lessons] = await Promise.all([
        context.learning.listTaskMemories({ limit: 500 }),
        context.learning.listLessons()
      ]);
      const similarTasks = findSimilarTaskMemories(memories, input);
      return recommendNextTaskSteps({ ...input, similarTasks, lessons });
    })
  );

  server.tool(
    "fabric_record_operator_feedback",
    "Record explicit operator feedback for a diagnosis, lesson, playbook, risk score, tool result, or task memory.",
    {
      targetType: z.string().min(1),
      targetId: z.string().min(1),
      rating: FeedbackRatingSchema,
      comment: z.string().optional(),
      accepted: z.boolean().optional(),
      payload: OptionalPayloadSchema
    },
    (input) => safeTool(async () => {
      await requireLearningEnabled(context);
      return context.learning.recordOperatorFeedback(input);
    })
  );

  server.tool(
    "fabric_list_learned_lessons",
    "List learned lessons filtered by workspace, environment, category, lesson type, or confidence.",
    {
      workspaceId: z.string().optional(),
      environmentLabel: z.string().optional(),
      lessonType: z.string().optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      limit: z.number().int().positive().max(200).optional()
    },
    (input) => safeTool(async () => {
      await requireLearningEnabled(context);
      const snapshot = await context.learning.exportSnapshot();
      for (const lesson of deriveLessonsFromSnapshot(snapshot)) {
        await context.learning.upsertLesson(lesson);
      }
      return context.learning.listLessons(input);
    })
  );

  server.tool(
    "fabric_analyze_learning_patterns",
    "Aggregate repeated issues, high-risk scopes, repeated task failures, and accepted recommendations.",
    {},
    () => safeTool(async () => {
      await requireLearningEnabled(context);
      return analyzeLearningPatterns(await context.learning.exportSnapshot());
    })
  );

  server.tool(
    "fabric_generate_learned_playbook",
    "Build a markdown-ready playbook from learned lessons and matching task memories.",
    {
      name: z.string().min(1),
      taskGoal: z.string().min(1),
      taskType: z.string().optional(),
      environmentLabel: z.string().optional(),
      workspaceId: z.string().optional()
    },
    (input) => safeTool(async () => {
      await requireLearningEnabled(context);
      const [memories, lessons] = await Promise.all([
        context.learning.listTaskMemories({ limit: 500 }),
        context.learning.listLessons()
      ]);
      const similarTasks = findSimilarTaskMemories(memories, input);
      const playbook = generateLearnedPlaybook({ name: input.name, taskGoal: input.taskGoal, lessons, similarTasks });
      await context.learning.upsertPlaybook({
        name: playbook.name,
        scopeKey: [input.environmentLabel, input.workspaceId, input.taskType].filter(Boolean).join(":") || "global",
        trigger: input.taskGoal,
        steps: playbook.steps,
        confidence: playbook.confidence,
        sourceLessonIds: playbook.sourceLessonIds,
        payload: { markdown: playbook.markdown }
      });
      return playbook;
    })
  );

  server.tool(
    "fabric_suggest_policy_improvements",
    "Suggest advisory policy improvements from repeated local learning patterns without writing policy files.",
    {
      minConfidence: z.number().min(0).max(1).optional()
    },
    (input) => safeTool(async () => {
      const policy = await requireLearningEnabled(context);
      return suggestPolicyImprovements(
        await context.learning.exportSnapshot(),
        input.minConfidence ?? policy.minLessonConfidenceForPolicySuggestions
      );
    })
  );

  server.tool(
    "fabric_export_learning_evidence",
    "Export redacted local learning evidence for marketplace, compliance, or release review.",
    {},
    () => safeTool(async () => {
      const policy = await requireLearningEnabled(context);
      if (!policy.allowLearningEvidenceExport) {
        throw new Error("Learning evidence export is blocked by policy.allowLearningEvidenceExport false.");
      }
      return exportLearningEvidence(await context.learning.exportSnapshot());
    })
  );
}

async function requireLearningEnabled(context: ToolContext) {
  const policy = await context.policy.load();
  if (!policy.allowLocalLearning) {
    throw new Error("Local learning is blocked by policy.allowLocalLearning false.");
  }
  return policy;
}

async function requireTaskMemoryEnabled(context: ToolContext) {
  const policy = await requireLearningEnabled(context);
  if (!policy.allowTaskMemory) {
    throw new Error("Task memory is blocked by policy.allowTaskMemory false.");
  }
  return policy;
}
