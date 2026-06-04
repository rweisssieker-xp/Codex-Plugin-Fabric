#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AuditLog } from "./audit.js";
import { MsalTokenProvider } from "./auth.js";
import { loadConfig } from "./config.js";
import { FabricClient } from "./fabricClient.js";
import { LocalState } from "./state.js";
import { ToolContext } from "./tools/context.js";
import { registerDeploymentTools } from "./tools/deployment.js";
import { registerGovernanceTools } from "./tools/governance.js";
import { registerIntelligenceTools } from "./tools/intelligence.js";
import { registerInventoryTools } from "./tools/inventory.js";
import { registerJobTools } from "./tools/jobs.js";

const config = loadConfig();
const tokenProvider = new MsalTokenProvider(config);
const client = new FabricClient(config, tokenProvider);
const context: ToolContext = {
  client,
  audit: new AuditLog(config.auditLogPath),
  state: new LocalState(config.stateDir)
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

const transport = new StdioServerTransport();
await server.connect(transport);
