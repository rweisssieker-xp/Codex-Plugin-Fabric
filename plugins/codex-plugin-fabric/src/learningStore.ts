import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { redact } from "./redaction.js";

export type LearningSeverity = "low" | "medium" | "high" | "critical";
export type TaskOutcome = "success" | "blocked" | "failed" | "partial" | "unknown";

export interface LearningStoreOptions {
  maxPayloadBytes?: number;
}

export interface LearningFilter {
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  environmentLabel?: string;
  category?: string;
  taskType?: string;
  limit?: number;
}

export interface LessonFilter extends LearningFilter {
  lessonType?: string;
  minConfidence?: number;
}

export interface TaskMemory {
  id: string;
  createdAt: string;
  updatedAt: string;
  taskGoal: string;
  taskType?: string;
  environmentLabel?: string;
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  planSummary?: string;
  toolsUsed: string[];
  assumptions: string[];
  decisions: string[];
  outcome: TaskOutcome;
  lesson?: string;
  doNextTime?: string[];
  avoidNextTime?: string[];
  confidence: number;
  evidenceRefs: string[];
  payload?: Record<string, unknown>;
  hash: string;
  incomplete: boolean;
}

export interface RecordTaskMemoryInput {
  taskGoal: string;
  taskType?: string;
  environmentLabel?: string;
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  planSummary?: string;
  toolsUsed?: string[];
  assumptions?: string[];
  decisions?: string[];
  outcome?: TaskOutcome;
  lesson?: string;
  doNextTime?: string[];
  avoidNextTime?: string[];
  confidence?: number;
  evidenceRefs?: string[];
  payload?: Record<string, unknown>;
}

export interface LearningEvent {
  id: string;
  timestamp: string;
  source: string;
  toolName?: string;
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  environmentLabel?: string;
  category: string;
  severity: LearningSeverity;
  summary: string;
  payload?: Record<string, unknown>;
  hash: string;
}

export interface RecordLearningEventInput {
  source: string;
  toolName?: string;
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  environmentLabel?: string;
  category: string;
  severity?: LearningSeverity;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface OperatorFeedback {
  id: string;
  timestamp: string;
  targetType: string;
  targetId: string;
  rating: "helpful" | "wrong" | "accepted" | "rejected" | "neutral";
  comment?: string;
  accepted?: boolean;
  payload?: Record<string, unknown>;
}

export interface RecordOperatorFeedbackInput {
  targetType: string;
  targetId: string;
  rating: OperatorFeedback["rating"];
  comment?: string;
  accepted?: boolean;
  payload?: Record<string, unknown>;
}

export interface LearnedLesson {
  id: string;
  createdAt: string;
  updatedAt: string;
  lessonType: string;
  scopeKey: string;
  title: string;
  summary: string;
  confidence: number;
  evidenceCount: number;
  lastEvidenceAt?: string;
  recommendation?: string;
  payload?: Record<string, unknown>;
}

export interface UpsertLessonInput {
  id?: string;
  lessonType: string;
  scopeKey: string;
  title: string;
  summary: string;
  confidence?: number;
  evidenceCount?: number;
  lastEvidenceAt?: string;
  recommendation?: string;
  payload?: Record<string, unknown>;
}

export interface LearnedPlaybook {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  scopeKey: string;
  trigger: string;
  steps: string[];
  confidence: number;
  sourceLessonIds: string[];
  payload?: Record<string, unknown>;
}

export interface UpsertPlaybookInput {
  id?: string;
  name: string;
  scopeKey: string;
  trigger: string;
  steps: string[];
  confidence?: number;
  sourceLessonIds?: string[];
  payload?: Record<string, unknown>;
}

export interface RiskObservation {
  id: string;
  timestamp: string;
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  riskLevel: LearningSeverity;
  reason: string;
  source: string;
  payload?: Record<string, unknown>;
}

export interface RecordRiskObservationInput {
  workspaceId?: string;
  itemId?: string;
  pipelineId?: string;
  riskLevel: LearningSeverity;
  reason: string;
  source: string;
  payload?: Record<string, unknown>;
}

export interface LearningStatus {
  enabled: boolean;
  path: string;
  counts: Record<keyof LearningDatabase, number>;
  lastLearningEvent?: string;
}

export interface LearningSnapshot extends LearningDatabase {
  exportedAt: string;
  checksum: string;
}

export interface LearningDatabase {
  taskMemories: TaskMemory[];
  learningEvents: LearningEvent[];
  operatorFeedback: OperatorFeedback[];
  learnedLessons: LearnedLesson[];
  learnedPlaybooks: LearnedPlaybook[];
  riskObservations: RiskObservation[];
}

const EMPTY_DATABASE: LearningDatabase = {
  taskMemories: [],
  learningEvents: [],
  operatorFeedback: [],
  learnedLessons: [],
  learnedPlaybooks: [],
  riskObservations: []
};

export class LearningStore {
  private readonly filePath: string;
  private readonly maxPayloadBytes: number;

  constructor(private readonly stateDir: string, options: LearningStoreOptions = {}) {
    this.filePath = path.join(this.stateDir, "learning.json");
    this.maxPayloadBytes = options.maxPayloadBytes ?? 65536;
  }

  async getStatus(): Promise<LearningStatus> {
    const db = await this.read();
    const lastLearningEvent = [
      ...db.learningEvents.map((entry) => entry.timestamp),
      ...db.taskMemories.map((entry) => entry.updatedAt),
      ...db.operatorFeedback.map((entry) => entry.timestamp)
    ].sort().at(-1);
    return {
      enabled: true,
      path: this.filePath,
      counts: {
        taskMemories: db.taskMemories.length,
        learningEvents: db.learningEvents.length,
        operatorFeedback: db.operatorFeedback.length,
        learnedLessons: db.learnedLessons.length,
        learnedPlaybooks: db.learnedPlaybooks.length,
        riskObservations: db.riskObservations.length
      },
      lastLearningEvent
    };
  }

  async recordTaskMemory(input: RecordTaskMemoryInput): Promise<TaskMemory> {
    const payload = this.cleanPayload(input.payload);
    const now = new Date().toISOString();
    const incomplete = !input.outcome || !input.lesson;
    const entry: TaskMemory = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      taskGoal: input.taskGoal,
      taskType: input.taskType,
      environmentLabel: input.environmentLabel,
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      pipelineId: input.pipelineId,
      planSummary: input.planSummary,
      toolsUsed: input.toolsUsed ?? [],
      assumptions: input.assumptions ?? [],
      decisions: input.decisions ?? [],
      outcome: input.outcome ?? "unknown",
      lesson: input.lesson,
      doNextTime: input.doNextTime ?? [],
      avoidNextTime: input.avoidNextTime ?? [],
      confidence: clamp(incomplete ? Math.min(input.confidence ?? 0.2, 0.3) : input.confidence ?? 0.5),
      evidenceRefs: input.evidenceRefs ?? [],
      payload,
      incomplete,
      hash: stableHash({ ...input, payload })
    };
    const db = await this.read();
    db.taskMemories.push(entry);
    await this.write(db);
    return entry;
  }

  async recordLearningEvent(input: RecordLearningEventInput): Promise<LearningEvent> {
    const payload = this.cleanPayload(input.payload);
    const entry: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: input.source,
      toolName: input.toolName,
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      pipelineId: input.pipelineId,
      environmentLabel: input.environmentLabel,
      category: input.category,
      severity: input.severity ?? "medium",
      summary: input.summary,
      payload,
      hash: stableHash({ ...input, payload })
    };
    const db = await this.read();
    db.learningEvents.push(entry);
    await this.write(db);
    return entry;
  }

  async recordOperatorFeedback(input: RecordOperatorFeedbackInput): Promise<OperatorFeedback> {
    const entry: OperatorFeedback = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      targetType: input.targetType,
      targetId: input.targetId,
      rating: input.rating,
      comment: input.comment,
      accepted: input.accepted,
      payload: this.cleanPayload(input.payload)
    };
    const db = await this.read();
    db.operatorFeedback.push(entry);
    await this.write(db);
    return entry;
  }

  async listTaskMemories(filter: LearningFilter = {}): Promise<TaskMemory[]> {
    return limit(filterByScope((await this.read()).taskMemories, filter), filter.limit);
  }

  async listLearningEvents(filter: LearningFilter = {}): Promise<LearningEvent[]> {
    return limit(filterByScope((await this.read()).learningEvents, filter), filter.limit);
  }

  async listFeedback(): Promise<OperatorFeedback[]> {
    return (await this.read()).operatorFeedback;
  }

  async upsertLesson(input: UpsertLessonInput): Promise<LearnedLesson> {
    const db = await this.read();
    const now = new Date().toISOString();
    const index = input.id
      ? db.learnedLessons.findIndex((lesson) => lesson.id === input.id)
      : db.learnedLessons.findIndex((lesson) => lesson.lessonType === input.lessonType && lesson.scopeKey === input.scopeKey && lesson.title === input.title);
    const previous = index >= 0 ? db.learnedLessons[index] : undefined;
    const entry: LearnedLesson = {
      id: previous?.id ?? input.id ?? randomUUID(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      lessonType: input.lessonType,
      scopeKey: input.scopeKey,
      title: input.title,
      summary: input.summary,
      confidence: clamp(input.confidence ?? previous?.confidence ?? 0.5),
      evidenceCount: input.evidenceCount ?? previous?.evidenceCount ?? 1,
      lastEvidenceAt: input.lastEvidenceAt ?? now,
      recommendation: input.recommendation,
      payload: this.cleanPayload(input.payload)
    };
    if (index >= 0) db.learnedLessons[index] = entry;
    else db.learnedLessons.push(entry);
    await this.write(db);
    return entry;
  }

  async listLessons(filter: LessonFilter = {}): Promise<LearnedLesson[]> {
    const lessons = (await this.read()).learnedLessons.filter((lesson) => {
      if (filter.lessonType && lesson.lessonType !== filter.lessonType) return false;
      if (filter.minConfidence !== undefined && lesson.confidence < filter.minConfidence) return false;
      if (filter.workspaceId && !lesson.scopeKey.includes(filter.workspaceId)) return false;
      if (filter.environmentLabel && !lesson.scopeKey.toLowerCase().includes(filter.environmentLabel.toLowerCase())) return false;
      return true;
    });
    return limit(lessons, filter.limit);
  }

  async upsertPlaybook(input: UpsertPlaybookInput): Promise<LearnedPlaybook> {
    const db = await this.read();
    const now = new Date().toISOString();
    const index = input.id
      ? db.learnedPlaybooks.findIndex((playbook) => playbook.id === input.id)
      : db.learnedPlaybooks.findIndex((playbook) => playbook.name === input.name && playbook.scopeKey === input.scopeKey);
    const previous = index >= 0 ? db.learnedPlaybooks[index] : undefined;
    const entry: LearnedPlaybook = {
      id: previous?.id ?? input.id ?? randomUUID(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      name: input.name,
      scopeKey: input.scopeKey,
      trigger: input.trigger,
      steps: input.steps,
      confidence: clamp(input.confidence ?? previous?.confidence ?? 0.5),
      sourceLessonIds: input.sourceLessonIds ?? [],
      payload: this.cleanPayload(input.payload)
    };
    if (index >= 0) db.learnedPlaybooks[index] = entry;
    else db.learnedPlaybooks.push(entry);
    await this.write(db);
    return entry;
  }

  async listPlaybooks(): Promise<LearnedPlaybook[]> {
    return (await this.read()).learnedPlaybooks;
  }

  async recordRiskObservation(input: RecordRiskObservationInput): Promise<RiskObservation> {
    const entry: RiskObservation = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      pipelineId: input.pipelineId,
      riskLevel: input.riskLevel,
      reason: input.reason,
      source: input.source,
      payload: this.cleanPayload(input.payload)
    };
    const db = await this.read();
    db.riskObservations.push(entry);
    await this.write(db);
    return entry;
  }

  async exportSnapshot(): Promise<LearningSnapshot> {
    const db = await this.read();
    return {
      ...db,
      exportedAt: new Date().toISOString(),
      checksum: stableHash(db)
    };
  }

  private cleanPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!payload) return undefined;
    const redacted = redact(payload) as Record<string, unknown>;
    const bytes = Buffer.byteLength(JSON.stringify(redacted), "utf8");
    if (bytes > this.maxPayloadBytes) {
      throw new Error(`Learning payload exceeds max size ${this.maxPayloadBytes} bytes.`);
    }
    return redacted;
  }

  private async read(): Promise<LearningDatabase> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Partial<LearningDatabase>;
      return {
        taskMemories: parsed.taskMemories ?? [],
        learningEvents: parsed.learningEvents ?? [],
        operatorFeedback: parsed.operatorFeedback ?? [],
        learnedLessons: parsed.learnedLessons ?? [],
        learnedPlaybooks: parsed.learnedPlaybooks ?? [],
        riskObservations: parsed.riskObservations ?? []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY_DATABASE };
      throw error;
    }
  }

  private async write(db: LearningDatabase): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(db, null, 2), "utf8");
  }
}

function filterByScope<T extends { workspaceId?: string; itemId?: string; pipelineId?: string; environmentLabel?: string; category?: string; taskType?: string }>(
  entries: T[],
  filter: LearningFilter
): T[] {
  return entries.filter((entry) => {
    if (filter.workspaceId && entry.workspaceId !== filter.workspaceId) return false;
    if (filter.itemId && entry.itemId !== filter.itemId) return false;
    if (filter.pipelineId && entry.pipelineId !== filter.pipelineId) return false;
    if (filter.environmentLabel && entry.environmentLabel !== filter.environmentLabel) return false;
    if (filter.category && entry.category !== filter.category) return false;
    if (filter.taskType && entry.taskType !== filter.taskType) return false;
    return true;
  });
}

function limit<T>(entries: T[], max?: number): T[] {
  return max ? entries.slice(0, max) : entries;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
