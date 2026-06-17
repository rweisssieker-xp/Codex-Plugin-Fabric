#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AuditLog } from "./audit.js";
import { MsalTokenProvider } from "./auth.js";
import { loadConfig } from "./config.js";
import { FabricClient } from "./fabricClient.js";
import { LearningStore } from "./learningStore.js";
import { PolicyStore } from "./policy.js";
import { LocalState } from "./state.js";
import { ToolContext } from "./tools/context.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerAdvancedUspTools } from "./tools/advancedUsps.js";
import { registerConnectionTools } from "./tools/connections.js";
import { registerDeploymentTools } from "./tools/deployment.js";
import { registerEnterpriseTools } from "./tools/enterprise.js";
import { registerGitTools } from "./tools/git.js";
import { registerGovernanceTools } from "./tools/governance.js";
import { registerIntelligenceTools } from "./tools/intelligence.js";
import { registerInventoryTools } from "./tools/inventory.js";
import { registerIncidentTools } from "./tools/incident.js";
import { registerInnovationTools } from "./tools/innovation.js";
import { registerJobTools } from "./tools/jobs.js";
import { registerLearningTools } from "./tools/learning.js";
import { registerWorkflowTools } from "./tools/workflows.js";

const config = loadConfig();
const tokenProvider = new MsalTokenProvider(config);
const client = new FabricClient(config, tokenProvider);
const policyStore = new PolicyStore(config);
const policy = await policyStore.load();
const context: ToolContext = {
  client,
  audit: new AuditLog(config.auditLogPath),
  state: new LocalState(config.stateDir),
  policy: policyStore,
  learning: new LearningStore(config.stateDir, { maxPayloadBytes: policy.maxLearningPayloadBytes })
};

const server = new McpServer({
  name: "codex-plugin-fabric",
  version: "0.1.0"
});

registerInventoryTools(server, context);
registerDeploymentTools(server, context);
registerJobTools(server, context);
registerIntelligenceTools(server, context);
registerGovernanceTools(server, context);
registerGitTools(server, context);
registerConnectionTools(server, context);
registerAdminTools(server, context);
registerIncidentTools(server, context);
registerInnovationTools(server, context);
registerEnterpriseTools(server, context);
registerAdvancedUspTools(server, context);
registerWorkflowTools(server, context);
registerLearningTools(server, context);

const transport = new StdioServerTransport();
await server.connect(transport);
