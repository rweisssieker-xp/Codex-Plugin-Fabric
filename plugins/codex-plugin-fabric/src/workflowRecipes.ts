export interface WorkflowRecipe {
  id: string;
  title: string;
  skill: string;
  goal: string;
  requiredInputs: string[];
  tools: string[];
  outcome: string;
}

export const WORKFLOW_RECIPES: WorkflowRecipe[] = [
  {
    id: "change-assurance",
    title: "Change Assurance Board Review",
    skill: "fabric-change-assurance",
    goal: "Prepare a score, report, and HTML evidence view before a high-impact Fabric change.",
    requiredInputs: ["workspaceId", "preflight result", "definition diff or change context"],
    tools: ["fabric_change_assurance_report", "fabric_change_assurance_score", "fabric_change_assurance_html"],
    outcome: "Board-ready assurance report with release blockers and required conditions."
  },
  {
    id: "policy-governance",
    title: "Policy-as-Code Governance Review",
    skill: "fabric-policy-governor",
    goal: "Simulate active policy against a real workspace and suggest tighter controls.",
    requiredInputs: ["workspaceId", "environmentLabel", "optional connectionIds", "optional gatewayIds"],
    tools: ["fabric_simulate_policy_on_workspace", "fabric_suggest_policy_tightening", "fabric_policy_diff"],
    outcome: "Read-only policy simulation and explicit tightening suggestions."
  },
  {
    id: "environment-drift",
    title: "Environment Drift Review",
    skill: "fabric-environment-drift",
    goal: "Compare dev/test/prod workspaces before deployment.",
    requiredInputs: ["sourceWorkspaceId", "targetWorkspaceId"],
    tools: ["fabric_fingerprint_workspace", "fabric_compare_environment_fingerprints", "fabric_drift_review_cards"],
    outcome: "Drift evidence cards for item, definition, connection, Git, role, and capacity differences."
  },
  {
    id: "incident-command",
    title: "Incident Command Brief",
    skill: "fabric-incident-commander",
    goal: "Create a timeline, root-cause ranking, and executive/operator brief.",
    requiredInputs: ["workspaceId", "optional deploymentPipelineId", "optional failed job targets"],
    tools: ["fabric_build_incident_timeline", "fabric_rank_root_causes", "fabric_incident_brief"],
    outcome: "Evidence-backed incident brief with ranked root-cause candidates."
  },
  {
    id: "release-playbook",
    title: "Guided Fabric Release",
    skill: "fabric-release-manager",
    goal: "Guide a Fabric deployment from preflight to final evidence.",
    requiredInputs: ["workspaceId", "deploymentPipelineId", "stageId", "environmentLabel", "preflight", "approvalPacket"],
    tools: ["fabric_generate_deploy_playbook", "fabric_validate_playbook_step", "fabric_finalize_mutation_evidence"],
    outcome: "Step-by-step guarded release playbook and final mutation evidence."
  },
  {
    id: "governance-board",
    title: "Governance Board Release Gate",
    skill: "fabric-governance-board",
    goal: "Decide go, conditional-go, or no-go from approval, blast radius, sensitivity, capacity, drift, incident, and assurance evidence.",
    requiredInputs: ["workspaceId", "approvalPacket", "assuranceScore", "optional drift", "optional incident evidence"],
    tools: [
      "fabric_build_approval_chain_evidence",
      "fabric_map_workspace_blast_radius",
      "fabric_review_data_sensitivity",
      "fabric_forecast_capacity_cost_risk",
      "fabric_release_readiness_gate"
    ],
    outcome: "Release gate decision with blockers, warnings, and required board conditions."
  },
  {
    id: "compliance-evidence",
    title: "Compliance Evidence Review",
    skill: "fabric-compliance-officer",
    goal: "Prepare audit-ready Fabric evidence with anomaly review, exception evaluation, risk matrix, and checksum-backed evidence bundle.",
    requiredInputs: ["workspaceId or release subject", "assurance evidence", "approval evidence", "optional policy exception"],
    tools: [
      "fabric_detect_audit_anomalies",
      "fabric_evaluate_policy_exception",
      "fabric_build_release_risk_matrix",
      "fabric_generate_compliance_evidence_bundle"
    ],
    outcome: "Audit-ready compliance evidence bundle with missing sections, checksums, anomalies, and release risks."
  },
  {
    id: "resilience-hardening",
    title: "Fabric Release Resilience Hardening",
    skill: "fabric-resilience-architect",
    goal: "Harden a Fabric release through what-if simulation, rollback readiness, ownership coverage, contract review, tenant posture, and operational SLO evidence.",
    requiredInputs: ["workspaceId", "optional changedItems", "optional job evidence", "optional required data contract terms"],
    tools: [
      "fabric_simulate_what_if_deployment",
      "fabric_assess_rollback_readiness",
      "fabric_analyze_ownership_coverage",
      "fabric_review_data_contracts",
      "fabric_summarize_tenant_posture",
      "fabric_evaluate_operational_slo"
    ],
    outcome: "Resilience hardening review with blockers, warnings, rollback posture, contract posture, ownership coverage, and SLO status."
  },
  {
    id: "executive-control",
    title: "Executive Fabric Control Board",
    skill: "fabric-executive-control",
    goal: "Create a management-ready release control view with criticality, freeze-window, access recertification, executive brief, and operator queue.",
    requiredInputs: ["workspaceId", "releaseGate", "riskMatrix", "operationalSlo", "optional freezeWindows"],
    tools: [
      "fabric_score_workspace_criticality",
      "fabric_check_change_freeze_window",
      "fabric_build_access_recertification_packet",
      "fabric_generate_executive_release_brief",
      "fabric_build_operator_action_queue"
    ],
    outcome: "Executive control brief plus prioritized operator action queue."
  },
  {
    id: "value-and-maturity",
    title: "Fabric Value And Maturity Review",
    skill: "fabric-value-and-maturity",
    goal: "Assess business impact, dependency bottlenecks, release calendar collisions, recovery drill readiness, and control maturity.",
    requiredInputs: ["workspaceId or item evidence", "graph", "optional release calendar", "control evidence"],
    tools: [
      "fabric_estimate_business_impact",
      "fabric_identify_dependency_bottlenecks",
      "fabric_detect_release_calendar_collisions",
      "fabric_generate_recovery_drill",
      "fabric_score_control_maturity"
    ],
    outcome: "Portfolio-ready value and maturity review with impact, bottlenecks, collisions, recovery drill, and maturity score."
  }
];

export function getWorkflowRecipe(id: string): WorkflowRecipe | undefined {
  return WORKFLOW_RECIPES.find((recipe) => recipe.id === id);
}

export function renderWorkflowPrompt(recipe: WorkflowRecipe): string {
  return [
    `Use the ${recipe.skill} skill.`,
    `Goal: ${recipe.goal}`,
    `Required inputs: ${recipe.requiredInputs.join(", ")}.`,
    `Use these tools in order where applicable: ${recipe.tools.join(" -> ")}.`,
    `Expected outcome: ${recipe.outcome}`
  ].join("\n");
}
