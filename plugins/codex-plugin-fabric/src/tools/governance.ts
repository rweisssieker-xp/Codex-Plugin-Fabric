import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema } from "./toolUtils.js";

export function registerGovernanceTools(server: McpServer, context: ToolContext): void {
  server.tool("fabric_get_policy", "Read the active local Fabric policy used by guardrails.", {}, () =>
    safeTool(async () => context.policy.load())
  );

  server.tool(
    "fabric_get_audit_log",
    "Read recent local audit log entries for mutating Fabric actions.",
    { limit: z.number().int().positive().max(500).optional().default(50) },
    ({ limit }) => safeTool(async () => context.audit.read(limit))
  );

  server.tool(
    "fabric_remember_environment",
    "Remember a non-sensitive local mapping between an environment label and Fabric target IDs.",
    {
      label: z.string().min(1),
      workspaceId: UuidSchema.optional(),
      pipelineId: UuidSchema.optional(),
      stageId: UuidSchema.optional(),
      notes: z.string().optional()
    },
    (input) => safeTool(async () => context.state.rememberEnvironment(input))
  );

  server.tool("fabric_list_known_environments", "List remembered local Fabric environments.", {}, () =>
    safeTool(async () => context.state.listKnownEnvironments())
  );
}
