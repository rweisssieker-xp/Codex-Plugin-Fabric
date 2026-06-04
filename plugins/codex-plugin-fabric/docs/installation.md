# Installation Guide

## Prerequisites

- Node.js 20 or newer
- A Microsoft Entra app registration for delegated device code auth
- Microsoft Fabric access for the signed-in identity
- Codex with plugin/MCP support

## Install Dependencies

```bash
cd plugins/codex-plugin-fabric
npm install
npm run build
```

## Configure Auth

Default auth mode is Microsoft Entra device code flow.

```bash
export FABRIC_AUTH_MODE=device_code
export FABRIC_TENANT_ID=common
export FABRIC_CLIENT_ID=<public-client-app-id>
```

On PowerShell:

```powershell
$env:FABRIC_AUTH_MODE = "device_code"
$env:FABRIC_TENANT_ID = "common"
$env:FABRIC_CLIENT_ID = "<public-client-app-id>"
```

## Optional Service Principal Auth

Use service principal mode only when the Fabric tenant setting and the target Fabric API support it.

```bash
export FABRIC_AUTH_MODE=service_principal
export FABRIC_TENANT_ID=<tenant-id>
export FABRIC_CLIENT_ID=<app-id>
export FABRIC_CLIENT_SECRET=<secret>
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Marketplace Install

Direct plugin path:

```bash
npx codex-marketplace add <owner>/<repo>/plugins/codex-plugin-fabric --plugin
```

Repository plugin crawl:

```bash
npx codex-marketplace add <owner>/<repo> --plugins
```

## Local MCP Config

The plugin ships `.mcp.json`:

```json
{
  "mcpServers": {
    "fabric-control": {
      "command": "node",
      "args": ["dist/server.js"]
    }
  }
}
```

## First Smoke Test

Ask Codex:

```text
Use Microsoft Fabric Control to list my Fabric workspaces.
```

If auth is not configured, the plugin should return a clear local auth error instead of leaking secrets.

