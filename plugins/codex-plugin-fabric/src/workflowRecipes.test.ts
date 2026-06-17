import assert from "node:assert/strict";
import test from "node:test";
import { getWorkflowRecipe, renderWorkflowPrompt, WORKFLOW_RECIPES } from "./workflowRecipes.js";

test("workflow recipes cover specialized skills", () => {
  const skills = new Set(WORKFLOW_RECIPES.map((recipe) => recipe.skill));

  assert.ok(skills.has("fabric-change-assurance"));
  assert.ok(skills.has("fabric-policy-governor"));
  assert.ok(skills.has("fabric-environment-drift"));
  assert.ok(skills.has("fabric-incident-commander"));
  assert.ok(skills.has("fabric-release-manager"));
  assert.ok(skills.has("fabric-governance-board"));
  assert.ok(skills.has("fabric-compliance-officer"));
  assert.ok(skills.has("fabric-resilience-architect"));
  assert.ok(skills.has("fabric-executive-control"));
  assert.ok(skills.has("fabric-value-and-maturity"));
});

test("workflow prompt includes skill and ordered tools", () => {
  const recipe = getWorkflowRecipe("release-playbook");
  assert.ok(recipe);
  const prompt = renderWorkflowPrompt(recipe);

  assert.match(prompt, /fabric-release-manager/);
  assert.match(prompt, /fabric_generate_deploy_playbook/);
  assert.match(prompt, /fabric_finalize_mutation_evidence/);
});

test("governance board recipe includes advanced USP gate tools", () => {
  const recipe = getWorkflowRecipe("governance-board");
  assert.ok(recipe);
  const prompt = renderWorkflowPrompt(recipe);

  assert.match(prompt, /fabric-governance-board/);
  assert.match(prompt, /fabric_review_data_sensitivity/);
  assert.match(prompt, /fabric_release_readiness_gate/);
});

test("compliance evidence recipe includes audit and bundle tools", () => {
  const recipe = getWorkflowRecipe("compliance-evidence");
  assert.ok(recipe);
  const prompt = renderWorkflowPrompt(recipe);

  assert.match(prompt, /fabric-compliance-officer/);
  assert.match(prompt, /fabric_detect_audit_anomalies/);
  assert.match(prompt, /fabric_generate_compliance_evidence_bundle/);
});

test("resilience hardening recipe includes simulation and SLO tools", () => {
  const recipe = getWorkflowRecipe("resilience-hardening");
  assert.ok(recipe);
  const prompt = renderWorkflowPrompt(recipe);

  assert.match(prompt, /fabric-resilience-architect/);
  assert.match(prompt, /fabric_simulate_what_if_deployment/);
  assert.match(prompt, /fabric_evaluate_operational_slo/);
});

test("executive control recipe includes brief and action queue tools", () => {
  const recipe = getWorkflowRecipe("executive-control");
  assert.ok(recipe);
  const prompt = renderWorkflowPrompt(recipe);

  assert.match(prompt, /fabric-executive-control/);
  assert.match(prompt, /fabric_generate_executive_release_brief/);
  assert.match(prompt, /fabric_build_operator_action_queue/);
});

test("value and maturity recipe includes impact and maturity tools", () => {
  const recipe = getWorkflowRecipe("value-and-maturity");
  assert.ok(recipe);
  const prompt = renderWorkflowPrompt(recipe);

  assert.match(prompt, /fabric-value-and-maturity/);
  assert.match(prompt, /fabric_estimate_business_impact/);
  assert.match(prompt, /fabric_score_control_maturity/);
});
