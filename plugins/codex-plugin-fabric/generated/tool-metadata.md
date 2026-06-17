# Fabric Control Tool Metadata

Generated: 2026-06-17T18:24:41.578Z

Endpoint metadata entries: 87

## inventory

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_list_workspaces` | GET | `/workspaces` | no | no | no | no |
| `fabric_get_workspace` | GET | `/workspaces/{workspaceId}` | no | no | no | no |
| `fabric_list_items` | GET | `/workspaces/{workspaceId}/items` | no | no | no | no |
| `fabric_get_item` | GET | `/workspaces/{workspaceId}/items/{itemId}` | no | no | no | no |

## definitions

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_get_item_definition` | POST | `/workspaces/{workspaceId}/items/{itemId}/getDefinition` | no | no | no | yes |
| `fabric_generate_deployment_review` | POST | `local://deployment-review` | no | no | no | no |
| `fabric_bulk_export_item_definitions` | POST | `/workspaces/{workspaceId}/items/bulkExport` | no | no | yes | yes |
| `fabric_update_item_definition` | POST | `/workspaces/{workspaceId}/items/{itemId}/updateDefinition` | yes | no | no | yes |

## deployment

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_list_deployment_pipelines` | GET | `/deploymentPipelines` | no | no | no | no |
| `fabric_get_deployment_pipeline` | GET | `/deploymentPipelines/{pipelineId}` | no | no | no | no |
| `fabric_list_deployment_stages` | GET | `/deploymentPipelines/{pipelineId}/stages` | no | no | no | no |
| `fabric_deployment_preflight` | POST | `local://deployment-preflight` | no | no | no | no |
| `fabric_list_deployment_pipeline_operations` | GET | `/deploymentPipelines/{pipelineId}/operations` | no | no | no | no |
| `fabric_get_deployment_pipeline_operation` | GET | `/deploymentPipelines/{pipelineId}/operations/{operationId}` | no | no | no | no |
| `fabric_deploy_stage_content` | POST | `/deploymentPipelines/{pipelineId}/stages/{stageId}/deploy` | yes | no | no | yes |

## jobs

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_run_item_job` | POST | `/workspaces/{workspaceId}/items/{itemId}/jobs/instances` | yes | no | no | no |

## git

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_git_get_connection` | GET | `/workspaces/{workspaceId}/git/connection` | no | no | no | no |
| `fabric_git_get_status` | GET | `/workspaces/{workspaceId}/git/status` | no | no | no | yes |
| `fabric_git_get_my_credentials` | GET | `/git/myGitCredentials` | no | no | no | no |
| `fabric_git_readiness` | GET | `local://git-readiness` | no | no | no | no |
| `fabric_git_connect` | POST | `/workspaces/{workspaceId}/git/connect` | yes | no | no | yes |
| `fabric_git_disconnect` | POST | `/workspaces/{workspaceId}/git/disconnect` | yes | no | no | yes |
| `fabric_git_commit` | POST | `/workspaces/{workspaceId}/git/commitToGit` | yes | no | no | yes |
| `fabric_git_update_from_git` | POST | `/workspaces/{workspaceId}/git/updateFromGit` | yes | no | no | yes |
| `fabric_git_initialize_connection` | POST | `/workspaces/{workspaceId}/git/initializeConnection` | yes | no | no | yes |
| `fabric_git_update_my_credentials` | PATCH | `/git/myGitCredentials` | yes | no | no | yes |

## admin

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_admin_list_items` | GET | `/admin/items` | no | yes | no | no |
| `fabric_admin_get_item` | GET | `/admin/items/{itemId}` | no | yes | no | no |
| `fabric_admin_list_workspaces` | GET | `/admin/workspaces` | no | yes | no | no |
| `fabric_admin_list_item_access_details` | GET | `/admin/items/{itemId}/users` | no | yes | no | no |
| `fabric_admin_list_workspace_access_details` | GET | `/admin/workspaces/{workspaceId}/users` | no | yes | no | no |
| `fabric_admin_list_user_access_entities` | GET | `/admin/users/{userId}/access` | no | yes | no | no |

## innovation

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_control_room_snapshot` | GET | `local://control-room-snapshot` | no | no | no | no |
| `fabric_build_lineage_map` | GET | `local://lineage-map` | no | no | no | no |
| `fabric_render_control_room_html` | POST | `local://control-room-html` | no | no | no | no |
| `fabric_generate_change_cards` | POST | `local://change-cards` | no | no | no | no |
| `fabric_create_approval_packet` | POST | `local://approval-packet` | no | no | no | no |
| `fabric_analyze_permissions` | GET | `local://permission-analysis` | no | no | no | no |
| `fabric_analyze_capacity_risk` | GET | `local://capacity-risk` | no | no | no | no |
| `fabric_correlate_incident` | GET | `local://incident-correlation` | no | no | no | no |
| `fabric_generate_recovery_plan` | POST | `local://recovery-plan` | no | no | no | no |
| `fabric_export_as_code_package` | POST | `local://fabric-as-code-package` | no | no | no | no |
| `fabric_validate_live_mutation_readiness` | POST | `local://live-mutation-readiness` | no | no | no | no |

## change_assurance

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_change_assurance_report` | POST | `local://change-assurance-report` | no | no | no | no |
| `fabric_change_assurance_score` | POST | `local://change-assurance-score` | no | no | no | no |
| `fabric_change_assurance_html` | POST | `local://change-assurance-html` | no | no | no | no |

## policy_simulation

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_simulate_policy_on_workspace` | POST | `local://policy-simulation` | no | no | no | no |
| `fabric_suggest_policy_tightening` | POST | `local://policy-tightening` | no | no | no | no |
| `fabric_policy_diff` | POST | `local://policy-diff` | no | no | no | no |

## environment_drift

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_fingerprint_workspace` | POST | `local://workspace-fingerprint` | no | no | no | no |
| `fabric_compare_environment_fingerprints` | POST | `local://environment-fingerprint-compare` | no | no | no | no |
| `fabric_drift_review_cards` | POST | `local://drift-review-cards` | no | no | no | no |

## incident_intelligence

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_build_incident_timeline` | POST | `local://incident-timeline` | no | no | no | no |
| `fabric_rank_root_causes` | POST | `local://root-cause-ranking` | no | no | no | no |
| `fabric_incident_brief` | POST | `local://incident-brief` | no | no | no | no |

## playbook

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_generate_deploy_playbook` | POST | `local://deploy-playbook` | no | no | no | no |
| `fabric_validate_playbook_step` | POST | `local://playbook-step-validation` | no | no | no | no |
| `fabric_finalize_mutation_evidence` | POST | `local://mutation-evidence` | no | no | no | no |

## advanced_usps

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_build_approval_chain_evidence` | POST | `local://approval-chain-evidence` | no | no | no | no |
| `fabric_forecast_capacity_cost_risk` | POST | `local://capacity-cost-risk` | no | no | no | no |
| `fabric_map_workspace_blast_radius` | POST | `local://workspace-blast-radius-map` | no | no | no | no |
| `fabric_review_data_sensitivity` | POST | `local://data-sensitivity-review` | no | no | no | no |
| `fabric_release_readiness_gate` | POST | `local://release-readiness-gate` | no | no | no | no |
| `fabric_generate_compliance_evidence_bundle` | POST | `local://compliance-evidence-bundle` | no | no | no | no |
| `fabric_detect_audit_anomalies` | POST | `local://audit-anomaly-detection` | no | no | no | no |
| `fabric_suggest_least_privilege_roles` | POST | `local://least-privilege-roles` | no | no | no | no |
| `fabric_evaluate_policy_exception` | POST | `local://policy-exception-evaluation` | no | no | no | no |
| `fabric_build_release_risk_matrix` | POST | `local://release-risk-matrix` | no | no | no | no |
| `fabric_simulate_what_if_deployment` | POST | `local://what-if-deployment` | no | no | no | no |
| `fabric_assess_rollback_readiness` | POST | `local://rollback-readiness` | no | no | no | no |
| `fabric_analyze_ownership_coverage` | POST | `local://ownership-coverage` | no | no | no | no |
| `fabric_review_data_contracts` | POST | `local://data-contract-review` | no | no | no | no |
| `fabric_summarize_tenant_posture` | POST | `local://tenant-posture` | no | no | no | no |
| `fabric_evaluate_operational_slo` | POST | `local://operational-slo` | no | no | no | no |
| `fabric_score_workspace_criticality` | POST | `local://workspace-criticality` | no | no | no | no |
| `fabric_check_change_freeze_window` | POST | `local://change-freeze-window` | no | no | no | no |
| `fabric_build_access_recertification_packet` | POST | `local://access-recertification` | no | no | no | no |
| `fabric_generate_executive_release_brief` | POST | `local://executive-release-brief` | no | no | no | no |
| `fabric_build_operator_action_queue` | POST | `local://operator-action-queue` | no | no | no | no |
| `fabric_estimate_business_impact` | POST | `local://business-impact` | no | no | no | no |
| `fabric_identify_dependency_bottlenecks` | POST | `local://dependency-bottlenecks` | no | no | no | no |
| `fabric_detect_release_calendar_collisions` | POST | `local://release-calendar-collisions` | no | no | no | no |
| `fabric_generate_recovery_drill` | POST | `local://recovery-drill` | no | no | no | no |
| `fabric_score_control_maturity` | POST | `local://control-maturity` | no | no | no | no |

## workflows

| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |
| --- | --- | --- | --- | --- | --- | --- |
| `fabric_list_workflow_recipes` | GET | `local://workflow-recipes` | no | no | no | no |
| `fabric_get_workflow_recipe` | GET | `local://workflow-recipe` | no | no | no | no |
| `fabric_generate_workflow_prompt` | POST | `local://workflow-prompt` | no | no | no | no |

