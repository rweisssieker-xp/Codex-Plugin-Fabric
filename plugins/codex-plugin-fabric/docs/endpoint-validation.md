# Endpoint Validation

Endpoint metadata lives in `src/fabricEndpoints.ts`. The registry records tool name, API group, method, path, mutation status, preview/beta/admin flags, guardrail requirements, and LRO support.

## Verify

```bash
npm run verify:endpoints
```

The verifier checks:

- critical mutating/admin/beta tools have registry entries
- mutating tools declare guardrail metadata
- no DELETE endpoint metadata exists
- smoke-tested guarded/admin/beta tools are represented

## Full Verification

```bash
npm run verify:all
```

This runs marketplace verification, endpoint verification, and the live Fabric smoke test. Without real non-production Fabric IDs, the live check reports `skipped`; with IDs configured, live check failures fail the command.

## Metadata Export

```bash
npm run export:tool-metadata
```

This writes `generated/tool-metadata.json` and `generated/tool-metadata.md` from `src/fabricEndpoints.ts`.
