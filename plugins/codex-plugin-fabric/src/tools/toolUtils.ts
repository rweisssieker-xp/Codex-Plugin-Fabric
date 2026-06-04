import { z } from "zod";
import { FabricApiError } from "../diagnostics.js";
import { redact } from "../redaction.js";

export const UuidSchema = z.string().uuid();

export function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(redact(value), null, 2)
      }
    ]
  };
}

export function errorResult(error: unknown) {
  if (error instanceof FabricApiError) {
    return textResult({ error: error.details });
  }
  return textResult({
    error: {
      category: "LocalError",
      message: error instanceof Error ? error.message : String(error)
    }
  });
}

export async function safeTool<T>(handler: () => Promise<T>) {
  try {
    return textResult(await handler());
  } catch (error) {
    return errorResult(error);
  }
}

export function valuesArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.value)) return record.value;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}
