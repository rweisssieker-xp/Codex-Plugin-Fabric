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
    "fabric_get_workspace",
    "Get one Fabric workspace by ID, including capacity assignment metadata when available.",
    { workspaceId: UuidSchema },
    ({ workspaceId }) => safeTool(async () => (await context.client.request(`/workspaces/${workspaceId}`)).data)
  );

  server.tool(
    "fabric_list_workspace_role_assignments",
    "List role assignments for a Fabric workspace.",
    { workspaceId: UuidSchema, continuationToken: z.string().optional() },
    ({ workspaceId, continuationToken }) =>
      safeTool(async () =>
        (
          await context.client.request(`/workspaces/${workspaceId}/roleAssignments`, {
            query: { continuationToken }
          })
        ).data
      )
  );

  server.tool(
    "fabric_get_workspace_role_assignment",
    "Get one role assignment for a Fabric workspace.",
    { workspaceId: UuidSchema, roleAssignmentId: UuidSchema },
    ({ workspaceId, roleAssignmentId }) =>
      safeTool(async () => (await context.client.request(`/workspaces/${workspaceId}/roleAssignments/${roleAssignmentId}`)).data)
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
    "fabric_workspace_health_score",
    "Compute a local health score for a Fabric workspace from inventory, known environments, capacity, graph, and optional Git status.",
    {
      workspaceId: UuidSchema,
      includeGitStatus: z.boolean().optional().default(false)
    },
    ({ workspaceId, includeGitStatus }) =>
      safeTool(async () => {
        const [workspace, itemsResponse, environments, gitStatus] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.state.listKnownEnvironments(),
          includeGitStatus
            ? context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response))
            : Promise.resolve(undefined)
        ]);
        const items = valuesArray(itemsResponse.data).map((item) => projectItem(item, workspaceId));
        const warnings: string[] = [];
        let score = 100;
        if (items.length === 0) {
          score -= 20;
          warnings.push("Workspace has no visible Fabric items.");
        }
        if (environments.filter((environment) => environment.workspaceId === workspaceId).length === 0) {
          score -= 10;
          warnings.push("Workspace is not remembered as an environment.");
        }
        if (JSON.stringify(workspace.data).toLowerCase().includes("failed")) {
          score -= 25;
          warnings.push("Workspace metadata contains a failed capacity assignment signal.");
        }
        if (gitStatus && JSON.stringify(gitStatus.data).toLowerCase().includes("conflict")) {
          score -= 20;
          warnings.push("Git status indicates conflicts.");
        }
        return {
          workspaceId,
          score: Math.max(0, score),
          itemCount: items.length,
          workspace: workspace.data,
          gitStatus: gitStatus?.data,
          warnings
        };
      })
  );

  server.tool(
    "fabric_workspace_snapshot",
    "Create a compact Fabric workspace health snapshot from inventory and known deployment context.",
    {
      workspaceId: UuidSchema,
      includeGraph: z.boolean().optional().default(true),
      includeCapacities: z.boolean().optional().default(false),
      allowAdminPreview: z.boolean().optional().default(false)
    },
    ({ workspaceId, includeGraph, includeCapacities, allowAdminPreview }) =>
      safeTool(async () => {
        const [itemsResponse, environments, capacitiesResponse, adminResponse] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.state.listKnownEnvironments(),
          includeCapacities ? context.client.request("/capacities") : Promise.resolve(undefined),
          allowAdminPreview
            ? context.client.request("/admin/items", { query: { workspaceId } })
            : Promise.resolve(undefined)
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
          capacities: capacitiesResponse?.data,
          adminItems: adminResponse?.data,
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
