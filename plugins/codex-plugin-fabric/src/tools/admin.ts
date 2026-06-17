import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { evaluatePolicy } from "../policy.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema } from "./toolUtils.js";

export function registerAdminTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_admin_list_workspaces",
    "List Fabric admin workspaces. Preview/admin mode requires allowAdminPreview true and policy allowAdminPreview.",
    {
      allowAdminPreview: z.boolean().optional(),
      continuationToken: z.string().optional()
    },
    (input) =>
      safeTool(async () => {
        const blocked = await adminPreviewBlockers(context, input.allowAdminPreview);
        if (blocked.length > 0) return { blocked: true, blockers: blocked };
        return (await context.client.request("/admin/workspaces", { query: { continuationToken: input.continuationToken } })).data;
      })
  );

  server.tool(
    "fabric_admin_list_items",
    "List Fabric admin items. Preview/admin mode requires allowAdminPreview true and policy allowAdminPreview.",
    {
      allowAdminPreview: z.boolean().optional(),
      workspaceId: UuidSchema.optional(),
      continuationToken: z.string().optional()
    },
    (input) =>
      safeTool(async () => {
        const blocked = await adminPreviewBlockers(context, input.allowAdminPreview);
        if (blocked.length > 0) return { blocked: true, blockers: blocked };
        return (
          await context.client.request("/admin/items", {
            query: { workspaceId: input.workspaceId, continuationToken: input.continuationToken }
          })
        ).data;
      })
  );

  server.tool(
    "fabric_admin_get_item",
    "Get one Fabric admin item. Preview/admin mode requires allowAdminPreview true and policy allowAdminPreview.",
    {
      itemId: UuidSchema,
      allowAdminPreview: z.boolean().optional()
    },
    (input) =>
      safeTool(async () => {
        const blocked = await adminPreviewBlockers(context, input.allowAdminPreview);
        if (blocked.length > 0) return { blocked: true, blockers: blocked };
        return (await context.client.request(`/admin/items/${input.itemId}`)).data;
      })
  );

  server.tool(
    "fabric_admin_list_item_access_details",
    "List admin access details for a Fabric item. Preview/admin mode requires allowAdminPreview true and policy allowAdminPreview.",
    {
      itemId: UuidSchema,
      allowAdminPreview: z.boolean().optional(),
      continuationToken: z.string().optional()
    },
    (input) =>
      safeTool(async () => {
        const blocked = await adminPreviewBlockers(context, input.allowAdminPreview);
        if (blocked.length > 0) return { blocked: true, blockers: blocked };
        return (
          await context.client.request(`/admin/items/${input.itemId}/users`, {
            query: { continuationToken: input.continuationToken }
          })
        ).data;
      })
  );

  server.tool(
    "fabric_admin_list_workspace_access_details",
    "List admin access details for a Fabric workspace. Preview/admin mode requires allowAdminPreview true and policy allowAdminPreview.",
    {
      workspaceId: UuidSchema,
      allowAdminPreview: z.boolean().optional(),
      continuationToken: z.string().optional()
    },
    (input) =>
      safeTool(async () => {
        const blocked = await adminPreviewBlockers(context, input.allowAdminPreview);
        if (blocked.length > 0) return { blocked: true, blockers: blocked };
        return (
          await context.client.request(`/admin/workspaces/${input.workspaceId}/users`, {
            query: { continuationToken: input.continuationToken }
          })
        ).data;
      })
  );

  server.tool(
    "fabric_admin_list_user_access_entities",
    "List admin access entities for a user principal. Preview/admin mode requires allowAdminPreview true and policy allowAdminPreview.",
    {
      userId: z.string().min(1),
      allowAdminPreview: z.boolean().optional(),
      continuationToken: z.string().optional()
    },
    (input) =>
      safeTool(async () => {
        const blocked = await adminPreviewBlockers(context, input.allowAdminPreview);
        if (blocked.length > 0) return { blocked: true, blockers: blocked };
        return (
          await context.client.request(`/admin/users/${encodeURIComponent(input.userId)}/access`, {
            query: { continuationToken: input.continuationToken }
          })
        ).data;
      })
  );


  server.tool("fabric_list_capacities", "List Fabric capacities accessible to the current identity.", {}, () =>
    safeTool(async () => (await context.client.request("/capacities")).data)
  );

  server.tool("fabric_get_capacity", "Get one Fabric capacity by ID.", { capacityId: UuidSchema }, ({ capacityId }) =>
    safeTool(async () => (await context.client.request(`/capacities/${capacityId}`)).data)
  );
}

async function adminPreviewBlockers(context: ToolContext, allowAdminPreview?: boolean): Promise<string[]> {
  const policy = await context.policy.load();
  const policyEvaluation = evaluatePolicy(policy, {
    action: "adminPreview",
    isAdminPreview: true,
    expectedWorkspaceId: "admin-preview"
  });
  const blockers = [...policyEvaluation.blockers];
  if (allowAdminPreview !== true) blockers.push("Admin preview APIs require allowAdminPreview: true.");
  return [...new Set(blockers)];
}
