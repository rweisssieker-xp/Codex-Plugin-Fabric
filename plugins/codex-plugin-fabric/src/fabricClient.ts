import { TokenProvider } from "./auth.js";
import { classifyFabricError, FabricApiError } from "./diagnostics.js";
import { FabricConfig, FabricResponse, JsonObject } from "./types.js";

export interface FabricRequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

export class FabricClient {
  constructor(
    private readonly config: FabricConfig,
    private readonly tokenProvider: TokenProvider,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async request<T = unknown>(path: string, options: FabricRequestOptions = {}): Promise<FabricResponse<T>> {
    const url = this.buildUrl(path, options.query);
    const token = await this.tokenProvider.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    const response = await this.fetchWithRetry(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined
    });

    const requestId = response.headers.get("x-ms-request-id") ?? response.headers.get("request-id") ?? undefined;
    const operationId =
      response.headers.get("x-ms-operation-id") ??
      response.headers.get("operation-id") ??
      extractOperationId(response.headers.get("location"));
    const data = await parseResponseBody(response);

    if (!response.ok) {
      const details = classifyFabricError({
        status: response.status,
        body: data,
        requestId,
        isRetriable: response.status === 429 || response.status >= 500
      });
      throw new FabricApiError(details);
    }

    return {
      data: data as T,
      status: response.status,
      headers: response.headers,
      requestId,
      operationId
    };
  }

  async requestAll<T = unknown>(path: string, options: FabricRequestOptions = {}): Promise<T[]> {
    const values: T[] = [];
    let continuationToken = options.query?.continuationToken;

    do {
      const response = await this.request(path, {
        ...options,
        query: { ...options.query, continuationToken }
      });
      const data = response.data as Record<string, unknown>;
      const pageValues = Array.isArray(data.value) ? data.value : Array.isArray(data.items) ? data.items : [];
      values.push(...(pageValues as T[]));
      continuationToken =
        typeof data.continuationToken === "string"
          ? data.continuationToken
          : typeof data.continuationUri === "string"
            ? new URL(data.continuationUri).searchParams.get("continuationToken") ?? undefined
            : undefined;
    } while (continuationToken);

    return values;
  }

  async resolveOperationIfPresent(response: FabricResponse, timeoutMs = 300000): Promise<FabricResponse> {
    const operationId = response.operationId ?? readOperationId(response.data);
    return operationId ? this.pollOperation(operationId, timeoutMs) : response;
  }

  async pollOperation(operationId: string, timeoutMs = 300000, intervalMs = 5000): Promise<FabricResponse> {
    const started = Date.now();
    let last: FabricResponse | undefined;

    while (Date.now() - started < timeoutMs) {
      last = await this.request(`/operations/${encodeURIComponent(operationId)}`);
      const status = operationStatus(last.data);
      if (status === "Succeeded") {
        return this.request(`/operations/${encodeURIComponent(operationId)}/result`);
      }
      if (status === "Failed") {
        throw new FabricApiError(
          classifyFabricError({
            status: last.status,
            body: last.data,
            requestId: last.requestId,
            message: "Long running operation failed."
          })
        );
      }
      await sleep(intervalMs);
    }

    throw new FabricApiError(
      classifyFabricError({
        message: `Operation ${operationId} timed out after ${timeoutMs} ms.`,
        body: last?.data,
        requestId: last?.requestId
      })
    );
  }

  private buildUrl(path: string, query?: FabricRequestOptions["query"]): string {
    const url = new URL(path.replace(/^\//, ""), `${this.config.baseUrl.replace(/\/$/, "")}/`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let response = await this.fetchImpl(url, init);
    if (response.status !== 429) return response;

    const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
    if (retryAfter > 0 && retryAfter <= 30) {
      await sleep(retryAfter * 1000);
      response = await this.fetchImpl(url, init);
    }
    return response;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return {};
  const text = await response.text();
  if (text.length === 0) return {};
  try {
    return JSON.parse(text) as JsonObject;
  } catch {
    return { text };
  }
}

function extractOperationId(location: string | null): string | undefined {
  if (!location) return undefined;
  const match = location.match(/\/operations\/([^/?]+)/i);
  return match?.[1];
}

function operationStatus(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.status === "string" ? record.status : undefined;
}

function readOperationId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.operationId === "string" ? record.operationId : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
