import assert from "node:assert/strict";
import test from "node:test";
import { redact } from "./redaction.js";

test("redaction removes secrets recursively", () => {
  const result = redact({
    Authorization: "Bearer abc",
    nested: {
      clientSecret: "secret",
      value: "kept"
    }
  }) as Record<string, unknown>;

  assert.equal(result.Authorization, "[REDACTED]");
  assert.deepEqual(result.nested, { clientSecret: "[REDACTED]", value: "kept" });
});
