import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildDependencyGraphFromItems } from "../graph.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

export function registerInventoryTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_list_workspaces",
    "List Microsoft Fabric workspaces accessible to the current identity.",
    { raw: z.boolean().optional().default(false) },
    ({ raw }) =>
      safeTool(async () => {
        const response = await context.client.request("/workspaces");
        if (raw) return response.data;
        return valuesArray(response.data).map(projectWorkspace);
      })
  );

  server.tool(
    "fabric_list_items",
    "List Microsoft Fabric items in a workspace, optionally filtered by item type.",
    {
      workspaceId: UuidSchema,
      type: z.string().optional(),
      raw: z.boolean().optional().default(false)
    },
    ({ workspaceId, type, raw }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items`);
        const items = valuesArray(response.data);
        const filtered = type ? items.filter((item) => itemType(item) === type) : items;
        return raw ? filtered : filtered.map((item) => projectItem(item, workspaceId));
      })
  );

  server.tool(
    "fabric_get_item",
    "Get one Microsoft Fabric item by workspace and item ID.",
    {
      workspaceId: UuidSchema,
      itemId: UuidSchema
    },
    ({ workspaceId, itemId }) =>
      safeTool(async () => {
        const response = await context.client.request(`/workspaces/${workspaceId}/items/${itemId}`);
        return response.data;
      })
  );

  server.tool(
    "fabric_workspace_snapshot",
    "Create a compact Fabric workspace health snapshot from inventory and known deployment context.",
    {
      workspaceId: UuidSchema,
      includeGraph: z.boolean().optional().default(true)
    },
    ({ workspaceId, includeGraph }) =>
      safeTool(async () => {
        const [itemsResponse, environments] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.state.listKnownEnvironments()
        ]);
        const items = valuesArray(itemsResponse.data).map((item) => projectItem(item, workspaceId));
        const byType = items.reduce<Record<string, number>>((acc, item) => {
          const type = typeof item.type === "string" ? item.type : "Unknown";
          acc[type] = (acc[type] ?? 0) + 1;
          return acc;
        }, {});
        const knownEnvironments = environments.filter((environment) => environment.workspaceId === workspaceId);
        return {
          workspaceId,
          itemCount: items.length,
          byType,
          knownEnvironments,
          graph: includeGraph ? buildDependencyGraphFromItems(items, workspaceId) : undefined,
          warnings: knownEnvironments.length === 0 ? ["Workspace is not remembered as an environment."] : []
        };
      })
  );
}

function projectWorkspace(item: unknown) {
  const record = item as Record<string, unknown>;
  return {
    id: record.id,
    displayName: record.displayName ?? record.name,
    description: record.description,
    capacityId: record.capacityId
  };
}

function projectItem(item: unknown, workspaceId: string) {
  const record = item as Record<string, unknown>;
  return {
    id: record.id,
    displayName: record.displayName ?? record.name,
    type: record.type,
    workspaceId,
    description: record.description
  };
}

function itemType(item: unknown): string | undefined {
  return typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).type === "string"
    ? ((item as Record<string, unknown>).type as string)
    : undefined;
}
