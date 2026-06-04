import { isProductionLabel } from "./guards.js";
import { RiskResult } from "./types.js";

export function classifyRisk(input: {
  action: string;
  environmentLabel?: string;
  itemCount?: number;
  hasExpectedTarget?: boolean;
  hasPreflight?: boolean;
  blockers?: string[];
}): RiskResult {
  const reasons: string[] = [];
  const blockers = [...(input.blockers ?? [])];
  let score = 0;

  if (isProductionLabel(input.environmentLabel)) {
    score += 3;
    reasons.push("Target environment appears production-like.");
  }
  if (!input.hasExpectedTarget) {
    score += 3;
    blockers.push("Expected target binding is missing.");
  }
  if (!input.hasPreflight && /deploy|run/i.test(input.action)) {
    score += 2;
    reasons.push("Action is mutating and has no successful preflight marker.");
  }
  if ((input.itemCount ?? 0) > 10) {
    score += 2;
    reasons.push("The action affects more than 10 items.");
  } else if ((input.itemCount ?? 0) > 0) {
    reasons.push(`The action affects ${input.itemCount} item(s).`);
  }

  const level = blockers.length > 0 || score >= 5 ? "high" : score >= 2 ? "medium" : "low";
  if (reasons.length === 0) reasons.push("No elevated risk signals were detected.");

  return { level, reasons, blockers: [...new Set(blockers)] };
}
