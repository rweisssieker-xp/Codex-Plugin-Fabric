import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve("../..");
const pluginRoot = process.cwd();
const required = [
  path.join(repoRoot, ".codex-plugin", "plugin.json"),
  path.join(repoRoot, ".mcp.json"),
  path.join(repoRoot, "skills", "fabric-operator", "SKILL.md"),
  path.join(repoRoot, ".agents", "plugins", "marketplace.json"),
  path.join(pluginRoot, ".codex-plugin", "plugin.json"),
  path.join(pluginRoot, ".mcp.json"),
  path.join(pluginRoot, "skills", "fabric-operator", "SKILL.md"),
  path.join(pluginRoot, "assets", "icon.svg"),
  path.join(pluginRoot, "assets", "logo.svg")
];

const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length > 0) {
  console.error(`Missing marketplace artifact files:\n${missing.join("\n")}`);
  process.exit(1);
}

const pluginSkills = skillNames(path.join(pluginRoot, "skills"));
const rootSkills = new Set(skillNames(path.join(repoRoot, "skills")));
const missingRootSkillShims = pluginSkills.filter((name) => !rootSkills.has(name));
if (missingRootSkillShims.length > 0) {
  console.error(`Missing root skill shims for plugin skills:\n${missingRootSkillShims.join("\n")}`);
  process.exit(1);
}

const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"]);
const binaryFiles = walk(repoRoot).filter((file) => {
  if (file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}dist${path.sep}`) || file.includes(`${path.sep}generated${path.sep}`)) return false;
  return binaryExtensions.has(path.extname(file).toLowerCase());
});
if (binaryFiles.length > 0) {
  console.error(`Binary evidence files require removal or manual review:\n${binaryFiles.join("\n")}`);
  process.exit(1);
}

for (const manifestPath of [required[0], required[4]]) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!manifest.name || !manifest.version || !manifest.interface?.displayName) {
    console.error(`Manifest is missing required marketplace metadata: ${manifestPath}`);
    process.exit(1);
  }
}

console.log("Marketplace verification passed.");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function skillNames(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(dir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}
