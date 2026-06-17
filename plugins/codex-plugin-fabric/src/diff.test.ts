import assert from "node:assert/strict";
import test from "node:test";
import { compareDefinitions } from "./diff.js";

test("definition diff detects added removed changed parts and references", () => {
  const oldReference = "11111111-1111-1111-1111-111111111111";
  const newReference = "22222222-2222-2222-2222-222222222222";
  const left = {
    parts: [
      { path: "model.json", payload: `old ${oldReference}` },
      { path: "removed.json", payload: "removed" }
    ]
  };
  const right = {
    parts: [
      { path: "model.json", payload: `new ${newReference}` },
      { path: "added.json", payload: "added" }
    ]
  };

  const diff = compareDefinitions(left, right);

  assert.deepEqual(diff.addedParts, ["added.json"]);
  assert.deepEqual(diff.removedParts, ["removed.json"]);
  assert.deepEqual(diff.changedParts, ["model.json"]);
  assert.deepEqual(diff.addedReferences, [newReference]);
  assert.deepEqual(diff.removedReferences, [oldReference]);
});
