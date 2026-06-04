import assert from "node:assert/strict";
import test from "node:test";
import { FabricClient } from "./fabricClient.js";
import { FabricConfig } from "./types.js";

const config: FabricConfig = {
  authMode: "device_code",
  tenantId: "common",
  clientId: "client",
  baseUrl: "https://api.fabric.microsoft.com/v1",
  stateDir: ".state",
  auditLogPath: ".audit/log.jsonl"
};

test("fabric client builds authenticated request and parses value response", async () => {
  const calls: string[] = [];
  const client = new FabricClient(
    config,
    { getAccessToken: async () => "token" },
    async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer token");
      return new Response(JSON.stringify({ value: [{ id: "1" }] }), {
        status: 200,
        headers: { "x-ms-request-id": "req-1" }
      });
    }
  );

  const result = await client.request("/workspaces");

  assert.equal(calls[0], "GET https://api.fabric.microsoft.com/v1/workspaces");
  assert.deepEqual(result.data, { value: [{ id: "1" }] });
  assert.equal(result.requestId, "req-1");
});

test("fabric client retries one 429 with Retry-After", async () => {
  let count = 0;
  const client = new FabricClient(
    config,
    { getAccessToken: async () => "token" },
    async () => {
      count += 1;
      if (count === 1) {
        return new Response(JSON.stringify({ errorCode: "TooManyRequests", message: "slow down" }), {
          status: 429,
          headers: { "Retry-After": "0.001" }
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  );

  const result = await client.request("/workspaces");
  assert.deepEqual(result.data, { ok: true });
  assert.equal(count, 2);
});
