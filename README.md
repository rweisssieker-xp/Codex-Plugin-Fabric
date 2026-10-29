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

## Optional Aivana reporting visual: financial variance review

**Provider disclosure:** Aivana Financial Reporting is a separate Aivana commercial Power BI visual, not part of this Fabric Control plugin.

For a Record-to-Report review, compare actuals, budget, forecast and prior year in a financial matrix, then check that comments remain attached to the correct business keys and filter context when month or organisation changes. Persistent comments require a **separately configured Fabric SQL integration**; neither importing the visual nor installing this plugin automatically provisions that storage.

- [Explore Financial Reporting and its integration requirements](https://aivana-gmbh.ai/en/powerbi-visuals/financial-reporting?utm_source=github&utm_medium=readme&utm_campaign=visual_trials_20261029)
- [Request the Financial Reporting trial](https://aivana-gmbh.ai/en/powerbi-visuals?product=financial-reporting&utm_source=github&utm_medium=readme&utm_campaign=visual_trials_20261029#trial)

The trial form requires name, company and email confirmation. Confirm package availability, licence scope and trial duration with Aivana, and validate the visual and its storage configuration in your intended Power BI/Fabric environment.
