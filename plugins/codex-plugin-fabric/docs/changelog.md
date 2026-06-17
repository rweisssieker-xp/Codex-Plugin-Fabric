# Changelog

## 0.1.0

Initial marketplace-ready release.

### Added

- TypeScript MCP server
- Microsoft Fabric REST client
- MSAL device code auth
- Optional service principal auth configuration
- Workspace and item inventory tools
- Deployment pipeline tools
- Deployment preflight
- Guarded deployment execution
- Long-running operation polling
- Item job run tools
- Failed run diagnostics
- Risk classification
- Dependency graph generation
- Blast-radius analysis
- Runbook generation
- Local audit logging
- Local environment memory
- Local policy file support
- Runtime policy inspection tool
- Item definition retrieval
- Definition-aware dependency graph enrichment
- Bundled `fabric-operator` skill
- MCP tool-list smoke test
- GitHub Actions CI workflow
- Git integration MCP tools
- Connections and gateways MCP tools
- Admin preview and capacity MCP tools
- Definition diff and deployment review tools
- Marketplace verification script
- Policy controls for Git, admin preview, connections, gateways, clean Git status, and definition diff size
- Git initialize connection tool
- Item connection, get capacity, get workspace, workspace health score, and workspace incident diagnosis tools
- Git credentials/readiness tools
- Workspace role assignment read tools
- Connection supported type, role assignment, and test connection tools
- Deployment pipeline operation history/detail tools
- Live Fabric smoke harness
- Endpoint registry and endpoint verifier
- Fabric-as-Code export, packaging, PR summary, and guarded item definition apply
- Admin governance access detail tools
- Permissions matrix and endpoint validation docs
- Tool metadata export script
- Marketplace evidence package generator
- Live smoke skip test
- Marketplace manifest
- Marketplace icon and logo
- Binary screenshots removed from submitted artifact to avoid manual evidence review
- US-English documentation and marketing kit
- Governed local learning layer with task memories, learning events, operator feedback, learned lessons, playbooks, pattern analysis, policy suggestions, and evidence export
- Learning policy controls for local learning, task memory, payload limits, evidence export, retention, and policy-suggestion confidence

### Security

- Secret redaction for logs and tool output
- Production guardrails
- Target binding for mutating actions
- No destructive V1 tools
- Learning stores structured summaries instead of full chat transcripts
- Learning recommendations are advisory and cannot bypass existing guardrails
