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
  blockedItemTypes: string[];
  environmentAliases: Record<string, string[]>;
}

export interface PolicyEvaluationInput extends GuardedMutationInput {
  action: string;
  itemCount?: number;
  itemTypes?: string[];
  payloadBytes?: number;
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
  blockedItemTypes: [],
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
    blockedItemTypes: input.blockedItemTypes ?? DEFAULT_POLICY.blockedItemTypes,
    environmentAliases: {
      ...DEFAULT_POLICY.environmentAliases,
      ...(input.environmentAliases ?? {})
    }
  };
}
