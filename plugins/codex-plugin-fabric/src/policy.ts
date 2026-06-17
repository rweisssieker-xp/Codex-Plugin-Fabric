import fs from "node:fs/promises";
import { FabricConfig, GuardedMutationInput } from "./types.js";

export interface FabricPolicy {
  version: number;
  productionLabels: string[];
  maxDeploymentItems: number;
  maxJobPayloadBytes: number;
  requirePreflightForProduction: boolean;
  requireExpectedTargetForMutation: boolean;
  allowedWorkspaceIds: string[];
  allowedPipelineIds: string[];
  allowedConnectionIds: string[];
  allowedGatewayIds: string[];
  blockedItemTypes: string[];
  allowGitMutations: boolean;
  allowAdminPreview: boolean;
  allowedGitProviders: string[];
  requireCleanGitBeforeDeployment: boolean;
  maxDefinitionDiffBytes: number;
  allowBetaApis: boolean;
  allowDefinitionApply: boolean;
  maxBulkExportItems: number;
  allowedApplyItemTypes: string[];
  requireDefinitionDiffApproval: boolean;
  allowLocalLearning: boolean;
  maxLearningPayloadBytes: number;
  learningRetentionDays: number;
  allowLearningEvidenceExport: boolean;
  minLessonConfidenceForPolicySuggestions: number;
  allowTaskMemory: boolean;
  allowAutomaticTaskSummaryMemory: boolean;
  maxTaskMemoryPayloadBytes: number;
  environmentAliases: Record<string, string[]>;
}

export interface PolicyEvaluationInput extends GuardedMutationInput {
  action: string;
  itemCount?: number;
  itemTypes?: string[];
  payloadBytes?: number;
  gitProvider?: string;
  connectionIds?: string[];
  gatewayIds?: string[];
  definitionDiffBytes?: number;
  isAdminPreview?: boolean;
  gitStatusClean?: boolean;
  isBetaApi?: boolean;
  isDefinitionApply?: boolean;
  expectedItemId?: string;
  actualItemId?: string;
  definitionDiffApproved?: boolean;
}

export interface PolicyEvaluation {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  policy: FabricPolicy;
}

export const DEFAULT_POLICY: FabricPolicy = {
  version: 1,
  productionLabels: ["prod", "production", "prd", "live"],
  maxDeploymentItems: 25,
  maxJobPayloadBytes: 65536,
  requirePreflightForProduction: true,
  requireExpectedTargetForMutation: true,
  allowedWorkspaceIds: [],
  allowedPipelineIds: [],
  allowedConnectionIds: [],
  allowedGatewayIds: [],
  blockedItemTypes: [],
  allowGitMutations: false,
  allowAdminPreview: false,
  allowedGitProviders: [],
  requireCleanGitBeforeDeployment: false,
  maxDefinitionDiffBytes: 1048576,
  allowBetaApis: false,
  allowDefinitionApply: false,
  maxBulkExportItems: 25,
  allowedApplyItemTypes: [],
  requireDefinitionDiffApproval: true,
  allowLocalLearning: true,
  maxLearningPayloadBytes: 65536,
  learningRetentionDays: 0,
  allowLearningEvidenceExport: true,
  minLessonConfidenceForPolicySuggestions: 0.5,
  allowTaskMemory: true,
  allowAutomaticTaskSummaryMemory: true,
  maxTaskMemoryPayloadBytes: 65536,
  environmentAliases: {
    dev: ["development", "sandbox"],
    test: ["qa", "uat"],
    production: ["prod", "prd", "live"]
  }
};

export class PolicyStore {
  constructor(private readonly config: FabricConfig) {}

  async load(): Promise<FabricPolicy> {
    const policyPath = this.config.policyPath;
    if (!policyPath) return DEFAULT_POLICY;
    try {
      const parsed = JSON.parse(await fs.readFile(policyPath, "utf8")) as Partial<FabricPolicy>;
      return normalizePolicy(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_POLICY;
      throw error;
    }
  }
}

export function evaluatePolicy(policy: FabricPolicy, input: PolicyEvaluationInput): PolicyEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const environmentLabel = input.environmentLabel ?? "";
  const production = isPolicyProductionLabel(policy, environmentLabel);

  if (policy.requireExpectedTargetForMutation && !input.expectedWorkspaceId && !input.expectedPipelineId) {
    blockers.push("Policy requires expectedWorkspaceId or expectedPipelineId for mutating actions.");
  }
  if (policy.allowedWorkspaceIds.length > 0 && input.actualWorkspaceId) {
    if (!policy.allowedWorkspaceIds.includes(input.actualWorkspaceId)) {
      blockers.push("Target workspace is not in policy.allowedWorkspaceIds.");
    }
  }
  if (policy.allowedPipelineIds.length > 0 && input.actualPipelineId) {
    if (!policy.allowedPipelineIds.includes(input.actualPipelineId)) {
      blockers.push("Target deployment pipeline is not in policy.allowedPipelineIds.");
    }
  }
  if ((input.itemCount ?? 0) > policy.maxDeploymentItems) {
    blockers.push(`Action affects ${input.itemCount} items, exceeding policy maxDeploymentItems ${policy.maxDeploymentItems}.`);
  }
  if ((input.payloadBytes ?? 0) > policy.maxJobPayloadBytes) {
    blockers.push(`Job payload exceeds policy maxJobPayloadBytes ${policy.maxJobPayloadBytes}.`);
  }
  if ((input.definitionDiffBytes ?? 0) > policy.maxDefinitionDiffBytes) {
    blockers.push(`Definition diff exceeds policy maxDefinitionDiffBytes ${policy.maxDefinitionDiffBytes}.`);
  }
  if (/^git/i.test(input.action) && !policy.allowGitMutations) {
    blockers.push("Policy blocks Git mutations. Set allowGitMutations true to enable guarded Git write actions.");
  }
  if (input.gitProvider && policy.allowedGitProviders.length > 0 && !policy.allowedGitProviders.includes(input.gitProvider)) {
    blockers.push("Git provider is not in policy.allowedGitProviders.");
  }
  if (input.isAdminPreview && !policy.allowAdminPreview) {
    blockers.push("Admin preview APIs require policy.allowAdminPreview true.");
  }
  if (input.isBetaApi && !policy.allowBetaApis) {
    blockers.push("Beta Fabric APIs require policy.allowBetaApis true.");
  }
  if (input.isDefinitionApply && !policy.allowDefinitionApply) {
    blockers.push("Definition apply requires policy.allowDefinitionApply true.");
  }
  if (input.expectedItemId && input.actualItemId && input.expectedItemId !== input.actualItemId) {
    blockers.push("expectedItemId does not match the target item.");
  }
  if (input.isDefinitionApply && policy.requireDefinitionDiffApproval && input.definitionDiffApproved !== true) {
    blockers.push("Definition apply requires definitionDiffApproved true.");
  }
  if (policy.requireCleanGitBeforeDeployment && input.action === "deploy" && input.gitStatusClean === false) {
    blockers.push("Policy requires clean Git status before deployment.");
  }
  const disallowedConnections = (input.connectionIds ?? []).filter(
    (id) => policy.allowedConnectionIds.length > 0 && !policy.allowedConnectionIds.includes(id)
  );
  if (disallowedConnections.length > 0) {
    blockers.push(`Connection ID(s) not allowed by policy: ${disallowedConnections.join(", ")}.`);
  }
  const disallowedGateways = (input.gatewayIds ?? []).filter(
    (id) => policy.allowedGatewayIds.length > 0 && !policy.allowedGatewayIds.includes(id)
  );
  if (disallowedGateways.length > 0) {
    blockers.push(`Gateway ID(s) not allowed by policy: ${disallowedGateways.join(", ")}.`);
  }
  const blockedTypes = (input.itemTypes ?? []).filter((type) => policy.blockedItemTypes.includes(type));
  if (blockedTypes.length > 0) {
    blockers.push(`Action includes blocked item type(s): ${[...new Set(blockedTypes)].join(", ")}.`);
  }
  if (production && policy.requirePreflightForProduction && input.preflightPassed !== true) {
    blockers.push("Policy requires successful preflight for production-like actions.");
  }
  if (!environmentLabel) {
    warnings.push("No environmentLabel was provided.");
  }

  return { allowed: blockers.length === 0, blockers, warnings, policy };
}

export function isPolicyProductionLabel(policy: FabricPolicy, label?: string): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  const values = new Set([
    ...policy.productionLabels.map((value) => value.toLowerCase()),
    ...(policy.environmentAliases.production ?? []).map((value) => value.toLowerCase())
  ]);
  return values.has(lower);
}

function normalizePolicy(input: Partial<FabricPolicy>): FabricPolicy {
  return {
    ...DEFAULT_POLICY,
    ...input,
    productionLabels: input.productionLabels ?? DEFAULT_POLICY.productionLabels,
    allowedWorkspaceIds: input.allowedWorkspaceIds ?? DEFAULT_POLICY.allowedWorkspaceIds,
    allowedPipelineIds: input.allowedPipelineIds ?? DEFAULT_POLICY.allowedPipelineIds,
    allowedConnectionIds: input.allowedConnectionIds ?? DEFAULT_POLICY.allowedConnectionIds,
    allowedGatewayIds: input.allowedGatewayIds ?? DEFAULT_POLICY.allowedGatewayIds,
    blockedItemTypes: input.blockedItemTypes ?? DEFAULT_POLICY.blockedItemTypes,
    allowedGitProviders: input.allowedGitProviders ?? DEFAULT_POLICY.allowedGitProviders,
    allowedApplyItemTypes: input.allowedApplyItemTypes ?? DEFAULT_POLICY.allowedApplyItemTypes,
    environmentAliases: {
      ...DEFAULT_POLICY.environmentAliases,
      ...(input.environmentAliases ?? {})
    }
  };
}
