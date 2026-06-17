import { extractReferencedIds } from "./graph.js";

export interface DefinitionPart {
  path: string;
  payload?: string;
  payloadType?: string;
}

export interface DefinitionDiff {
  addedParts: string[];
  removedParts: string[];
  changedParts: string[];
  unchangedParts: string[];
  addedReferences: string[];
  removedReferences: string[];
  totalBytes: number;
  releaseNoteSummary: string;
}

export function compareDefinitions(left: unknown, right: unknown): DefinitionDiff {
  const leftParts = normalizeParts(left);
  const rightParts = normalizeParts(right);
  const allPaths = new Set([...leftParts.keys(), ...rightParts.keys()]);
  const addedParts: string[] = [];
  const removedParts: string[] = [];
  const changedParts: string[] = [];
  const unchangedParts: string[] = [];

  for (const path of [...allPaths].sort()) {
    const leftPart = leftParts.get(path);
    const rightPart = rightParts.get(path);
    if (!leftPart && rightPart) addedParts.push(path);
    else if (leftPart && !rightPart) removedParts.push(path);
    else if (stableStringify(leftPart) !== stableStringify(rightPart)) changedParts.push(path);
    else unchangedParts.push(path);
  }

  const leftReferences = new Set(extractReferencedIds(left));
  const rightReferences = new Set(extractReferencedIds(right));
  const addedReferences = [...rightReferences].filter((id) => !leftReferences.has(id)).sort();
  const removedReferences = [...leftReferences].filter((id) => !rightReferences.has(id)).sort();
  const totalBytes = Buffer.byteLength(stableStringify(left) + stableStringify(right), "utf8");

  return {
    addedParts,
    removedParts,
    changedParts,
    unchangedParts,
    addedReferences,
    removedReferences,
    totalBytes,
    releaseNoteSummary: summarizeDiff(addedParts.length, removedParts.length, changedParts.length, addedReferences.length, removedReferences.length)
  };
}

function normalizeParts(definition: unknown): Map<string, unknown> {
  if (!definition || typeof definition !== "object") return new Map([["definition", definition]]);
  const record = definition as Record<string, unknown>;
  if (!Array.isArray(record.parts)) return new Map([["definition", definition]]);
  const parts = new Map<string, unknown>();
  for (const [index, part] of record.parts.entries()) {
    if (!part || typeof part !== "object") {
      parts.set(`part-${index}`, part);
      continue;
    }
    const partRecord = part as Record<string, unknown>;
    const path = typeof partRecord.path === "string" ? partRecord.path : `part-${index}`;
    parts.set(path, part);
  }
  return parts;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortValue(entry)])
    );
  }
  return value;
}

function summarizeDiff(added: number, removed: number, changed: number, addedRefs: number, removedRefs: number): string {
  const fragments = [
    `${added} part(s) added`,
    `${removed} part(s) removed`,
    `${changed} part(s) changed`,
    `${addedRefs} reference(s) added`,
    `${removedRefs} reference(s) removed`
  ];
  return `Definition diff: ${fragments.join(", ")}.`;
}
