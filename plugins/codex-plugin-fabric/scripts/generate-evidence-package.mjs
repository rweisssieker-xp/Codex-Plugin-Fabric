import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const repoRoot = path.resolve("../..");
const evidenceDir = path.join(root, "generated", "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const checks = [
  ["npm-test.txt", npmCommand, ["test"]],
  ["npm-smoke.txt", npmCommand, ["run", "smoke"]],
  ["npm-audit.txt", npmCommand, ["audit", "--omit=dev"]],
  ["verify-endpoints.txt", npmCommand, ["run", "verify:endpoints"]],
  ["verify-marketplace.txt", "node", ["scripts/verify-marketplace.mjs"]]
];

const manifest = {
  generatedAt: new Date().toISOString(),
  checks: [],
  artifact: {
    rootManifest: exists(path.join(repoRoot, ".codex-plugin", "plugin.json")),
    nestedManifest: exists(path.join(root, ".codex-plugin", "plugin.json")),
    rootMcp: exists(path.join(repoRoot, ".mcp.json")),
    nestedMcp: exists(path.join(root, ".mcp.json")),
    rootSkill: exists(path.join(repoRoot, "skills", "fabric-operator", "SKILL.md")),
    nestedSkill: exists(path.join(root, "skills", "fabric-operator", "SKILL.md"))
  }
};

for (const [fileName, command, args] of checks) {
  const target = path.join(evidenceDir, fileName);
  try {
    const output = execFileSync(command, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
    });
    fs.writeFileSync(target, output, "utf8");
    manifest.checks.push({ fileName, ok: true });
  } catch (error) {
    fs.writeFileSync(target, `${error.message ?? ""}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`, "utf8");
    manifest.checks.push({ fileName, ok: false });
  }
}

const binaryFiles = walk(repoRoot).filter((file) => {
  if (file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}dist${path.sep}`) || file.includes(`${path.sep}generated${path.sep}`)) {
    return false;
  }
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"].includes(path.extname(file).toLowerCase());
});
manifest.binaryEvidenceFiles = binaryFiles;

fs.writeFileSync(path.join(evidenceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
if (manifest.checks.some((check) => !check.ok) || binaryFiles.length > 0) {
  console.error(`Evidence package generated with failures at ${evidenceDir}`);
  process.exit(1);
}
console.log(`Evidence package generated at ${evidenceDir}`);

function exists(file) {
  return fs.existsSync(file);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}
