# Marketplace Submission Checklist

## Repository Structure

- [x] Plugin lives under `plugins/codex-plugin-fabric`
- [x] Plugin manifest lives at `plugins/codex-plugin-fabric/.codex-plugin/plugin.json`
- [x] MCP config lives at `plugins/codex-plugin-fabric/.mcp.json`
- [x] Bundled skill lives at `plugins/codex-plugin-fabric/skills/fabric-operator/SKILL.md`
- [x] Repo marketplace file lives at `.agents/plugins/marketplace.json`
- [x] Marketplace entry points to `./plugins/codex-plugin-fabric`

## Manifest

- [x] `name` is kebab-case
- [x] `version` is semantic
- [x] `description` is present
- [x] `author.name` is present
- [x] `mcpServers` points to `./.mcp.json`
- [x] `skills` points to `./skills/`
- [x] `interface.displayName` is present
- [x] `interface.shortDescription` is under marketplace length expectations
- [x] `interface.longDescription` explains the value clearly
- [x] `interface.category` is set to Data
- [x] `interface.defaultPrompt` includes useful starter prompts

## Technical Validation

- [x] `npm run build`
- [x] `npm test`
- [x] `npm run smoke`
- [x] Plugin validator passes
- [x] `npm audit --omit=dev` reports no vulnerabilities

## Marketing Materials

- [x] Marketplace listing copy
- [x] Product overview
- [x] Installation guide
- [x] Operator guide
- [x] Tool catalog
- [x] Security and governance notes
- [x] Launch kit
- [x] Sales one-pager
- [x] Demo script
- [x] Press release
- [x] Privacy and security notice

## Recommended Before Public Submission

- [x] Add project logo and composer icon under `assets/`
- [x] Avoid binary screenshots in the submitted artifact
- [ ] Run live Fabric smoke test with a non-production workspace
- [ ] Confirm Microsoft Fabric API permissions for target users
