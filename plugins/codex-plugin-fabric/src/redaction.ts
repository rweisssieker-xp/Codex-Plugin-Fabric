const SECRET_KEYS = [
  "authorization",
  "accessToken",
  "refreshToken",
  "clientSecret",
  "secret",
  "password",
  "token"
];

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEYS.some((secretKey) => key.toLowerCase().includes(secretKey.toLowerCase()))) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = redact(entry);
      }
    }
    return output;
  }

  if (typeof value === "string" && value.startsWith("Bearer ")) {
    return "Bearer [REDACTED]";
  }

  return value;
}
