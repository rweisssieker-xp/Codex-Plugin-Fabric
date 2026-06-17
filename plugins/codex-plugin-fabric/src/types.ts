export type JsonObject = Record<string, unknown>;

export type FabricAuthMode = "device_code" | "service_principal";

export interface FabricConfig {
  authMode: FabricAuthMode;
  tenantId: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl: string;
  stateDir: string;
  auditLogPath: string;
  policyPath?: string;
}

export interface FabricErrorDetails {
  status?: number;
  category: string;
  message: string;
  requestId?: string;
  isRetriable?: boolean;
  raw?: unknown;
  nextSteps: string[];
}

export interface FabricResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
  requestId?: string;
  operationId?: string;
}

export interface GuardedMutationInput {
  confirm?: boolean;
  environmentLabel?: string;
  expectedWorkspaceId?: string;
  expectedPipelineId?: string;
  actualWorkspaceId?: string;
  actualPipelineId?: string;
  allowProduction?: boolean;
  preflightPassed?: boolean;
}

export interface GuardResult {
  allowed: boolean;
  blockers: string[];
}

export interface RiskResult {
  level: "low" | "medium" | "high";
  reasons: string[];
  blockers: string[];
}

export interface AuditRecord {
  timestamp: string;
  tool: string;
  target: JsonObject;
  status: "started" | "succeeded" | "failed" | "blocked";
  requestId?: string;
  operationId?: string;
  input?: unknown;
  error?: unknown;
}

export interface KnownEnvironment {
  label: string;
  workspaceId?: string;
  pipelineId?: string;
  stageId?: string;
  notes?: string;
  rememberedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: JsonObject;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  confidence: "observed";
  reason: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
