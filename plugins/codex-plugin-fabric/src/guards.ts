import { GuardedMutationInput, GuardResult } from "./types.js";

export function isProductionLabel(label?: string): boolean {
  if (!label) return false;
  return /\b(prod|production|prd|live)\b/i.test(label);
}

export function validateMutationGuard(input: GuardedMutationInput): GuardResult {
  const blockers: string[] = [];

  if (input.confirm !== true) {
    blockers.push("Mutating Fabric actions require confirm: true.");
  }
  if (!input.environmentLabel) {
    blockers.push("Mutating Fabric actions require environmentLabel.");
  }
  if (!input.expectedWorkspaceId && !input.expectedPipelineId) {
    blockers.push("Mutating Fabric actions require expectedWorkspaceId or expectedPipelineId.");
  }
  if (input.expectedWorkspaceId && input.actualWorkspaceId && input.expectedWorkspaceId !== input.actualWorkspaceId) {
    blockers.push("expectedWorkspaceId does not match the resolved target workspace.");
  }
  if (input.expectedPipelineId && input.actualPipelineId && input.expectedPipelineId !== input.actualPipelineId) {
    blockers.push("expectedPipelineId does not match the resolved target deployment pipeline.");
  }
  if (isProductionLabel(input.environmentLabel) && input.allowProduction !== true) {
    blockers.push("Production-sensitive actions require allowProduction: true.");
  }
  if (isProductionLabel(input.environmentLabel) && input.preflightPassed !== true) {
    blockers.push("Production-sensitive actions require a successful preflight in the action input.");
  }

  return {
    allowed: blockers.length === 0,
    blockers
  };
}
