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

export function enrichGraphFromDefinitions(
  graph: DependencyGraph,
  definitions: Array<{ itemId: string; definition: unknown }>
): DependencyGraph {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = [...graph.edges];

  for (const entry of definitions) {
    const target = nodesById.get(entry.itemId);
    if (!target) continue;

    for (const referenceId of extractReferencedIds(entry.definition)) {
      const source = nodesById.get(referenceId);
      if (!source) continue;
      if (edges.some((edge) => edge.from === source.id && edge.to === target.id && edge.relation === "definition-reference")) {
        continue;
      }
      edges.push({
        from: source.id,
        to: target.id,
        relation: "definition-reference",
        confidence: "observed",
        reason: "The target item definition references this source item ID."
      });
    }
  }

  return { nodes: graph.nodes, edges };
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

export function extractReferencedIds(definition: unknown): string[] {
  const text = collectDefinitionText(definition);
  const matches = text.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g);
  return [...new Set(matches ?? [])];
}

export function decodeDefinitionPayloads(definition: unknown): unknown {
  if (!definition || typeof definition !== "object") return definition;
  const record = definition as JsonObject;
  const parts = Array.isArray(record.parts) ? record.parts : undefined;
  if (!parts) return definition;

  return {
    ...record,
    parts: parts.map((part) => {
      if (!part || typeof part !== "object") return part;
      const partRecord = part as JsonObject;
      const payload = typeof partRecord.payload === "string" ? partRecord.payload : undefined;
      if (!payload) return part;
      return {
        ...partRecord,
        decodedPayload: decodePayload(payload)
      };
    })
  };
}

function collectDefinitionText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return `${value}\n${decodePayload(value) ?? ""}`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(collectDefinitionText).join("\n");
  if (typeof value === "object") return Object.values(value).map(collectDefinitionText).join("\n");
  return "";
}

function decodePayload(payload: string): string | undefined {
  try {
    return Buffer.from(payload, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
