import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildDependencyGraphFromItems } from "../graph.js";
import { ToolContext } from "./context.js";
import { safeTool, UuidSchema, valuesArray } from "./toolUtils.js";

export function registerIncidentTools(server: McpServer, context: ToolContext): void {
  server.tool(
    "fabric_diagnose_workspace_incident",
    "Build a read-only incident summary for a Fabric workspace from inventory, Git status, connections, graph, and audit context.",
    {
      workspaceId: UuidSchema
    },
    ({ workspaceId }) =>
      safeTool(async () => {
        const [workspace, itemsResponse, gitStatus, auditLog] = await Promise.all([
          context.client.request(`/workspaces/${workspaceId}`),
          context.client.request(`/workspaces/${workspaceId}/items`),
          context.client.request(`/workspaces/${workspaceId}/git/status`).then((response) => context.client.resolveOperationIfPresent(response)),
          context.audit.read(20)
        ]);
        const items = valuesArray(itemsResponse.data);
        const connectionSummaries = await Promise.all(
          items.slice(0, 20).map(async (item) => {
            const itemId = typeof item === "object" && item !== null ? (item as Record<string, unknown>).id : undefined;
            if (typeof itemId !== "string") return undefined;
            const response = await context.client.request(`/workspaces/${workspaceId}/items/${itemId}/connections`);
            return { itemId, connections: response.data };
          })
        );
        const graph = buildDependencyGraphFromItems(items, workspaceId);
        const roleAssignments = await context.client.request(`/workspaces/${workspaceId}/roleAssignments`);
        const signals = deriveIncidentSignals(workspace.data, gitStatus.data, connectionSummaries);
        return {
          workspaceId,
          itemCount: items.length,
          workspace: workspace.data,
          gitStatus: gitStatus.data,
          graph,
          roleAssignments: roleAssignments.data,
          connectionSummaries: connectionSummaries.filter(Boolean),
          recentAudit: auditLog,
          signals,
          recommendation: "Review high-severity signals first, then inspect affected item connections and recent audit entries."
        };
      })
  );
}

function deriveIncidentSignals(workspace: unknown, gitStatus: unknown, connections: unknown[]): Array<{ severity: string; message: string }> {
  const signals: Array<{ severity: string; message: string }> = [];
  const workspaceText = JSON.stringify(workspace).toLowerCase();
  const gitText = JSON.stringify(gitStatus).toLowerCase();
  if (workspaceText.includes("failed")) signals.push({ severity: "high", message: "Workspace metadata contains a failure signal." });
  if (gitText.includes("conflict")) signals.push({ severity: "medium", message: "Git status contains a conflict signal." });
  if (connections.some((connection) => JSON.stringify(connection).toLowerCase().includes("error"))) {
    signals.push({ severity: "medium", message: "One or more item connection lookups returned errors." });
  }
  if (signals.length === 0) signals.push({ severity: "low", message: "No obvious incident signals were detected from available read-only checks." });
  return signals;
}
