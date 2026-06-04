# Microsoft Fabric Control for Codex

Microsoft Fabric Control is a local Codex plugin that turns Codex into a safe Microsoft Fabric operator. It provides MCP tools for Fabric workspace inventory, deployment pipeline control, job runs, diagnostics, dependency intelligence, blast-radius analysis, local audit logging, and production guardrails.

## Install from Codex Marketplace

```bash
npx codex-marketplace add <owner>/<repo> --plugins
```

Or install this plugin directly from a repository path:

```bash
npx codex-marketplace add <owner>/<repo>/plugins/codex-plugin-fabric --plugin
```

## Repository Layout

```text
.
├── .agents/plugins/marketplace.json
├── plugins/codex-plugin-fabric/
│   ├── .codex-plugin/plugin.json
│   ├── .mcp.json
│   ├── docs/
│   ├── src/
│   └── README.md
└── README.md
```

## Documentation

- [Marketplace Listing](plugins/codex-plugin-fabric/docs/marketplace-listing.md)
- [Product Overview](plugins/codex-plugin-fabric/docs/product-overview.md)
- [Installation Guide](plugins/codex-plugin-fabric/docs/installation.md)
- [Operator Guide](plugins/codex-plugin-fabric/docs/operator-guide.md)
- [Tool Catalog](plugins/codex-plugin-fabric/docs/tool-catalog.md)
- [Security and Governance](plugins/codex-plugin-fabric/docs/security-governance.md)
- [Launch Kit](plugins/codex-plugin-fabric/docs/launch-kit.md)
- [Submission Checklist](plugins/codex-plugin-fabric/docs/submission-checklist.md)

