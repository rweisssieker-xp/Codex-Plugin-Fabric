import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDependencyGraphFromItems,
  decodeDefinitionPayloads,
  enrichGraphFromDefinitions,
  extractReferencedIds
} from "./graph.js";

const lakehouseId = "11111111-1111-1111-1111-111111111111";
const notebookId = "22222222-2222-2222-2222-222222222222";

test("dependency graph only creates nodes from item inventory", () => {
  const graph = buildDependencyGraphFromItems([
    { id: lakehouseId, displayName: "lh", type: "Lakehouse" },
    { id: notebookId, displayName: "nb", type: "Notebook" }
  ]);

  assert.deepEqual(graph.edges, []);
  assert.equal(graph.nodes.length, 2);
});

test("extractReferencedIds reads plain and base64 payload references", () => {
  const encoded = Buffer.from(`{"lakehouseId":"${lakehouseId}"}`, "utf8").toString("base64");
  const ids = extractReferencedIds({ parts: [{ payload: encoded }] });

  assert.deepEqual(ids, [lakehouseId]);
});

test("enrichGraphFromDefinitions adds observed definition-reference edge", () => {
  const graph = buildDependencyGraphFromItems([
    { id: lakehouseId, displayName: "lh", type: "Lakehouse" },
    { id: notebookId, displayName: "nb", type: "Notebook" }
  ]);

  const enriched = enrichGraphFromDefinitions(graph, [
    { itemId: notebookId, definition: { content: `uses ${lakehouseId}` } }
  ]);

  assert.ok(
    enriched.edges.some(
      (edge) =>
        edge.from === lakehouseId &&
        edge.to === notebookId &&
        edge.relation === "definition-reference" &&
        edge.confidence === "observed"
    )
  );
});

test("decodeDefinitionPayloads adds decoded payload field", () => {
  const encoded = Buffer.from("hello", "utf8").toString("base64");
  const decoded = decodeDefinitionPayloads({ parts: [{ payload: encoded }] }) as {
    parts: Array<{ decodedPayload?: string }>;
  };

  assert.equal(decoded.parts[0]?.decodedPayload, "hello");
});
