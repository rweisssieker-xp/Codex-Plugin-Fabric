# Live Fabric Smoke Test

The live smoke test validates real Microsoft Fabric connectivity against a non-production workspace. When required environment variables are missing, it reports a structured `skipped` result so local release verification can still run without Fabric tenant credentials.

## Configure

Copy `.env.live.example` and fill in non-production IDs:

```bash
FABRIC_AUTH_MODE=device_code
FABRIC_TENANT_ID=common
FABRIC_CLIENT_ID=<public-client-app-id>
FABRIC_TEST_WORKSPACE_ID=<workspace-id>
FABRIC_TEST_ITEM_ID=<item-id>
FABRIC_TEST_PIPELINE_ID=<deployment-pipeline-id>
FABRIC_TEST_STAGE_ID=<stage-id>
FABRIC_TEST_CONNECTION_ID=<optional-connection-id>
```

## Run

```bash
npm run smoke:fabric-live
```

## Behavior

The live smoke test performs read-only checks by default:

- list/get workspace
- list/get item
- get item definition
- Git status
- list connections/gateways/capacities
- list deployment stages and stage items

When the required test IDs are absent, the script exits successfully with `status: "skipped"` and lists the missing variables. When the IDs are configured, any failed live check exits non-zero.

Mutating live smoke remains disabled unless explicitly added and guarded in a separate workflow.
