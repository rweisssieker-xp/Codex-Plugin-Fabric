import { FabricErrorDetails } from "./types.js";

export class FabricApiError extends Error {
  details: FabricErrorDetails;

  constructor(details: FabricErrorDetails) {
    super(details.message);
    this.name = "FabricApiError";
    this.details = details;
  }
}

export function classifyFabricError(args: {
  status?: number;
  body?: unknown;
  message?: string;
  requestId?: string;
  isRetriable?: boolean;
}): FabricErrorDetails {
  const rawMessage = extractMessage(args.body) ?? args.message ?? "Fabric request failed.";
  const errorCode = extractErrorCode(args.body);
  const status = args.status;

  let category = "OperationFailure";
  const nextSteps: string[] = [];

  if (status === 401) {
    category = "Auth";
    nextSteps.push("Refresh the Microsoft Entra sign-in and verify FABRIC_TENANT_ID/FABRIC_CLIENT_ID.");
  } else if (status === 403) {
    category = "Permission";
    nextSteps.push("Verify Fabric workspace permissions and required delegated scopes for this API.");
  } else if (status === 404) {
    category = "NotFound";
    nextSteps.push("Check the workspace, item, stage, pipeline, or operation ID.");
  } else if (status === 429) {
    category = "RateLimit";
    nextSteps.push("Retry after the server-provided Retry-After delay.");
  } else if (status && status >= 400 && status < 500) {
    category = "Validation";
    nextSteps.push("Check required parameters, item type support, and target environment IDs.");
  } else if (status && status >= 500) {
    category = "Service";
    nextSteps.push("Retry later or inspect Fabric service health if the issue persists.");
  }

  const combined = `${rawMessage} ${errorCode ?? ""}`.toLowerCase();
  if (combined.includes("service principal") || combined.includes("managed identit")) {
    category = "UnsupportedIdentity";
    nextSteps.push("Use delegated user auth or confirm service principal support for the specific Fabric API.");
  }
  if (combined.includes("unsupported") && combined.includes("item")) {
    category = "UnsupportedItemType";
    nextSteps.push("Use a supported job type or item type for this Fabric API.");
  }
  if (combined.includes("timeout")) {
    category = "Timeout";
    nextSteps.push("Increase timeout or inspect the long-running operation state manually.");
  }

  if (nextSteps.length === 0) {
    nextSteps.push("Inspect the Fabric request ID in Microsoft support or retry only if the response is retriable.");
  }

  return {
    status,
    category,
    message: errorCode ? `${rawMessage} (${errorCode})` : rawMessage,
    requestId: args.requestId,
    isRetriable: args.isRetriable,
    raw: args.body,
    nextSteps: [...new Set(nextSteps)]
  };
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const nested = record.error as Record<string, unknown> | undefined;
  return stringValue(record.message) ?? stringValue(nested?.message);
}

function extractErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const nested = record.error as Record<string, unknown> | undefined;
  return stringValue(record.errorCode) ?? stringValue(nested?.errorCode) ?? stringValue(nested?.code);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
