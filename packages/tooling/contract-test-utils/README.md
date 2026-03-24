# @launchdarkly/js-contract-test-utils

Shared utilities for LaunchDarkly JavaScript SDK contract tests. This package provides universal types, logging utilities, and a client-side test hook that are used across multiple SDK contract test implementations.

This is a **internal** package used only within this monorepo. We do not have any plans to publish this to npm.

## Subpath Exports

The package uses subpath exports to organize code by platform:

| Import Path | Contents | Resolution |
|---|---|---|
| `@launchdarkly/js-contract-test-utils` | Universal types, logging, `ClientPool` | Source `.ts` (for bundlers) |
| `@launchdarkly/js-contract-test-utils/adapter` | `startAdapter()`, `AdapterOptions` | Compiled `.js` |
| `@launchdarkly/js-contract-test-utils/client` | Client-side `TestHook` | Source `.ts` (for bundlers) |
| `@launchdarkly/js-contract-test-utils/server` | Server-side `ServerSideTestHook`, `ServerSDKConfigParams` | Compiled `.js` |

## Adapter (`"./adapter"`)

Provides the REST↔WebSocket adapter server. This adapter is used to allow client side sdks that are typically used to drive applications that do not have a server side runtime.
The design decision here is to have this adapter layer facilitate the REST interactions with the sdk testharness server.

```ts
import { startAdapter } from '@launchdarkly/js-contract-test-utils/adapter';

startAdapter({ restPort: 8000, wsPort: 8001 });
```

- **`startAdapter(options?)`** -- Starts an Express server (REST) and WebSocket server that bridges the SDK test harness to browser-based entities. Configurable via `AdapterOptions` (`restPort`, `wsPort`).

### CLI

The package also ships a CLI binary `sdk-testharness-server` (alias `sts`):

```bash
# Start the adapter with default ports (8000/8001)
sdk-testharness-server adapter

# Override ports via environment variables
ADAPTER_REST_PORT=9000 ADAPTER_WS_PORT=9001 sdk-testharness-server adapter
```

## Build

```bash
yarn build
```

## Architecture

```
contract-test-utils/
  src/
    adapter/
      startAdapter.ts             # REST↔WebSocket bridge server + AdapterOptions
    bin/
      sdk-testharness-server.ts   # CLI entry point
    client-side/
      TestHook.ts                 # fetch()-based hook reporting
    server-side/
      ClientPool.ts               # Generic entity pool
    logging/
      makeLogger.ts               # Logger factory
    types/
      CommandParams.ts            # Command/response type definitions
      ConfigParams.ts             # SDK configuration type definitions
      compat.ts                   # Minimal cross-SDK type aliases
    index.ts                      # Universal exports
    adapter.ts                    # Adapter exports
    client.ts                     # Client-side exports
```
