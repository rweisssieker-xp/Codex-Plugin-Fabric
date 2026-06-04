import fs from "node:fs/promises";
import path from "node:path";
import { AuditRecord } from "./types.js";
import { redact } from "./redaction.js";

export class AuditLog {
  constructor(private readonly filePath: string) {}

  async append(record: AuditRecord): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const redacted = redact(record);
    await fs.appendFile(this.filePath, `${JSON.stringify(redacted)}\n`, "utf8");
  }

  async read(limit = 50): Promise<unknown[]> {
    try {
      const text = await fs.readFile(this.filePath, "utf8");
      return text
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-limit)
        .map((line) => JSON.parse(line) as unknown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
