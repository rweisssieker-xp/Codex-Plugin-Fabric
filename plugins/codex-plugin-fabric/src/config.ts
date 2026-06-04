import path from "node:path";
import { FabricConfig, FabricAuthMode } from "./types.js";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function loadConfig(): FabricConfig {
  const authMode = (env("FABRIC_AUTH_MODE") ?? "device_code") as FabricAuthMode;
  if (authMode !== "device_code" && authMode !== "service_principal") {
    throw new Error("FABRIC_AUTH_MODE must be device_code or service_principal.");
  }

  const stateDir = env("FABRIC_STATE_DIR") ?? path.join(".fabric-plugin", "state");
  const auditLogPath =
    env("FABRIC_AUDIT_LOG") ?? path.join(".fabric-plugin", "audit", "fabric-actions.jsonl");

  return {
    authMode,
    tenantId: env("FABRIC_TENANT_ID") ?? "common",
    clientId: env("FABRIC_CLIENT_ID"),
    clientSecret: env("FABRIC_CLIENT_SECRET"),
    baseUrl: env("FABRIC_BASE_URL") ?? "https://api.fabric.microsoft.com/v1",
    stateDir,
    auditLogPath,
    policyPath: env("FABRIC_POLICY_PATH")
  };
}
