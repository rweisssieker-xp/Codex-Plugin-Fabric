import { AuditLog } from "../audit.js";
import { FabricClient } from "../fabricClient.js";
import { LocalState } from "../state.js";

export interface ToolContext {
  client: FabricClient;
  audit: AuditLog;
  state: LocalState;
}
