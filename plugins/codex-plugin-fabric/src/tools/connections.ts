import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema } from "./toolUtils.js";

export function registerConnectionTools(server: McpServer, context: ToolContext): void {
  server.tool("fabric_list_connections", "List Fabric connections accessible to the current identity.", {}, () =>
    safeTool(async () => (await context.client.request("/connections")).data)
  );

  server.tool("fabric_get_connection", "Get one Fabric connection by ID.", { connectionId: UuidSchema }, ({ connectionId }) =>
    safeTool(async () => (await context.client.request(`/connections/${connectionId}`)).data)
  );

  server.tool("fabric_list_gateways", "List Fabric gateways accessible to the current identity.", {}, () =>
    safeTool(async () => (await context.client.request("/gateways")).data)
  );

  server.tool("fabric_get_gateway", "Get one Fabric gateway by ID.", { gatewayId: UuidSchema }, ({ gatewayId }) =>
    safeTool(async () => (await context.client.request(`/gateways/${gatewayId}`)).data)
  );

  server.tool("fabric_list_supported_connection_types", "List Fabric supported connection types.", {}, () =>
    safeTool(async () => (await context.client.request("/connections/supportedConnectionTypes")).data)
  );

  server.tool(
    "fabric_list_connection_role_assignments",
    "List role assignments for a Fabric connection.",
    { connectionId: UuidSchema, continuationToken: z.string().optional() },
    ({ connectionId, continuationToken }) =>
      safeTool(async () =>
        (
          await context.client.request(`/connections/${connectionId}/roleAssignments`, {
            query: { continuationToken }
          })
        ).data
      )
  );

  server.tool(
    "fabric_test_connection",
    "Test a Fabric connection and resolve the long-running operation when returned.",
    { connectionId: UuidSchema, timeoutMs: z.number().int().positive().max(900000).optional().default(300000) },
    ({ connectionId, timeoutMs }) =>
      safeTool(async () => {
        const response = await context.client.request(`/connections/${connectionId}/testConnection`, {
          method: "POST",
          body: {}
        });
        const resolved = await context.client.resolveOperationIfPresent(response, timeoutMs);
        return { operationId: response.operationId, result: resolved.data };
      })
  );

  server.tool(
    "fabric_list_item_connections",
    "List connections used by a specific Fabric item.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema,
      continuationToken: z.string().optional()
    },
    ({ workspaceId, itemId, continuationToken }) =>
      safeTool(async () =>
        (
          await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/connections`, {
            query: { continuationToken }
          })
        ).data
      )
  );

  server.tool(
    "fabric_check_connection_policy",
    "Check connection and gateway IDs against the active local Fabric policy.",
    {
      connectionIds: z.array(UuidSchema).optional(),
      gatewayIds: z.array(UuidSchema).optional()
    },
    ({ connectionIds, gatewayIds }) =>
      safeTool(async () => {
        const policy = await context.policy.load();
        const connectionBlockers = (connectionIds ?? []).filter(
          (id) => policy.allowedConnectionIds.length > 0 && !policy.allowedConnectionIds.includes(id)
        );
        const gatewayBlockers = (gatewayIds ?? []).filter(
          (id) => policy.allowedGatewayIds.length > 0 && !policy.allowedGatewayIds.includes(id)
        );
        return {
          allowed: connectionBlockers.length === 0 && gatewayBlockers.length === 0,
          connectionBlockers,
          gatewayBlockers
        };
      })
  );
}
