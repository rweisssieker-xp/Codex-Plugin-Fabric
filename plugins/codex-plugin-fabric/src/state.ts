import fs from "node:fs/promises";
import path from "node:path";
import { KnownEnvironment } from "./types.js";

export class LocalState {
  private readonly environmentsPath: string;

  constructor(private readonly stateDir: string) {
    this.environmentsPath = path.join(this.stateDir, "known-environments.json");
  }

  async rememberEnvironment(input: Omit<KnownEnvironment, "rememberedAt">): Promise<KnownEnvironment> {
    const environments = await this.listKnownEnvironments();
    const next: KnownEnvironment = { ...input, rememberedAt: new Date().toISOString() };
    const filtered = environments.filter((environment) => environment.label !== next.label);
    filtered.push(next);
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.environmentsPath, JSON.stringify(filtered, null, 2), "utf8");
    return next;
  }

  async listKnownEnvironments(): Promise<KnownEnvironment[]> {
    try {
      const text = await fs.readFile(this.environmentsPath, "utf8");
      return JSON.parse(text) as KnownEnvironment[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
