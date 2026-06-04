import { DependencyGraph, GraphEdge, GraphNode, JsonObject } from "./types.js";

const KNOWN_TYPES = new Set(["Lakehouse", "Warehouse", "Notebook", "DataPipeline", "SemanticModel", "Report"]);

export function buildDependencyGraphFromItems(items: unknown[], workspaceId?: string): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as JsonObject;
    const id = stringValue(record.id);
    const label = stringValue(record.displayName) ?? stringValue(record.name) ?? id;
    const type = stringValue(record.type) ?? "Unknown";
    if (!id || !label) continue;
    nodes.push({ id, label, type, metadata: { workspaceId, rawTypeKnown: KNOWN_TYPES.has(type) } });
  }

  const lakehouses = nodes.filter((node) => node.type === "Lakehouse");
  const warehouses = nodes.filter((node) => node.type === "Warehouse");
  const dataSources = [...lakehouses, ...warehouses];

  for (const node of nodes) {
    if (node.type === "Notebook" || node.type === "DataPipeline" || node.type === "SemanticModel") {
      for (const source of dataSources) {
        edges.push({
          from: source.id,
          to: node.id,
          relation: "possible-data-source",
          confidence: "inferred",
          reason: `${node.type} can depend on ${source.type}; Fabric API data did not expose a stronger relationship.`
        });
      }
    }
    if (node.type === "SemanticModel") {
      for (const report of nodes.filter((candidate) => candidate.type === "Report")) {
        edges.push({
          from: node.id,
          to: report.id,
          relation: "possible-report-model",
          confidence: "inferred",
          reason: "Reports commonly depend on semantic models; edge is heuristic until item metadata exposes lineage."
        });
      }
    }
  }

  return { nodes, edges };
}

export function analyzeBlastRadius(graph: DependencyGraph, changedItemIds: string[]): {
  affectedNodes: GraphNode[];
  edges: GraphEdge[];
  summary: string;
} {
  const changed = new Set(changedItemIds);
  const affectedIds = new Set(changed);
  let expanded = true;

  while (expanded) {
    expanded = false;
    for (const edge of graph.edges) {
      if (affectedIds.has(edge.from) && !affectedIds.has(edge.to)) {
        affectedIds.add(edge.to);
        expanded = true;
      }
    }
  }

  const affectedNodes = graph.nodes.filter((node) => affectedIds.has(node.id));
  const affectedEdges = graph.edges.filter((edge) => affectedIds.has(edge.from) && affectedIds.has(edge.to));

  return {
    affectedNodes,
    edges: affectedEdges,
    summary: `${affectedNodes.length} node(s) are in the potential blast radius; ${affectedEdges.length} relationship(s) explain the impact.`
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
