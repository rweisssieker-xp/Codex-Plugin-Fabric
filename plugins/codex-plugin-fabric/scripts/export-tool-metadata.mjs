import fs from "node:fs";
import path from "node:path";
import { FABRIC_ENDPOINTS } from "../dist/fabricEndpoints.js";

const outDir = path.join(process.cwd(), "generated");
fs.mkdirSync(outDir, { recursive: true });

const byGroup = Object.groupBy(FABRIC_ENDPOINTS, (endpoint) => endpoint.group);
const catalog = {
  generatedAt: new Date().toISOString(),
  toolCount: FABRIC_ENDPOINTS.length,
  groups: Object.fromEntries(
    Object.entries(byGroup).map(([group, endpoints]) => [
      group,
      {
        count: endpoints?.length ?? 0,
        endpoints
      }
    ])
  )
};

fs.writeFileSync(path.join(outDir, "tool-metadata.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "tool-metadata.md"), renderMarkdown(catalog), "utf8");
console.log(`Tool metadata exported to ${outDir}`);

function renderMarkdown(value) {
  const lines = ["# Fabric Control Tool Metadata", "", `Generated: ${value.generatedAt}`, "", `Endpoint metadata entries: ${value.toolCount}`, ""];
  for (const [group, groupData] of Object.entries(value.groups)) {
    lines.push(`## ${group}`, "");
    lines.push("| Tool | Method | Path | Mutating | Admin/Preview | Beta | LRO |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const endpoint of groupData.endpoints) {
      lines.push(
        `| \`${endpoint.tool}\` | ${endpoint.method} | \`${endpoint.path}\` | ${yes(endpoint.mutating)} | ${yes(endpoint.adminPreview)} | ${yes(endpoint.beta)} | ${yes(endpoint.lro)} |`
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function yes(value) {
  return value ? "yes" : "no";
}
