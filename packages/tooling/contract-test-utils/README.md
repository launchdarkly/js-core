# @launchdarkly/js-contract-test-utils

Shared utilities for LaunchDarkly JavaScript SDK contract tests. This package provides universal types, logging utilities, and a client-side test hook that are used across multiple SDK contract test implementations.

This is a **private** package (not published to npm) used only within this monorepo.

## Subpath Exports

The package uses subpath exports to organize code by platform:

| Import Path | Contents | Resolution |
|---|---|---|
| `@launchdarkly/js-contract-test-utils` | Universal types, logging, `ClientPool` | Source `.ts` (for bundlers) |
| `@launchdarkly/js-contract-test-utils/adapter` | `startAdapter()`, `AdapterOptions` | Compiled `.js` |
| `@launchdarkly/js-contract-test-utils/client` | Client-side `TestHook` | Source `.ts` (for bundlers) |

### Universal (`"."`)

Types and utilities with no SDK dependency:

```ts
import {
  CommandType,
  ValueType,
  CommandParams,
  CreateInstanceParams,
  SDKConfigParams,
  makeLogger,
  ClientPool,
} from '@launchdarkly/js-contract-test-utils';
```

### Adapter (`"./adapter"`)

For browser, React, and React Native contract tests. Provides the REST↔WebSocket adapter server:

```ts
import { startAdapter } from '@launchdarkly/js-contract-test-utils/adapter';

startAdapter({ restPort: 8000, wsPort: 8001 });
```

- **`startAdapter(options?)`** -- Starts an Express server (REST) and WebSocket server that bridges the SDK test harness to browser-based entities. Configurable via `AdapterOptions` (`restPort`, `wsPort`).

#### CLI

The package also ships a CLI binary `sdk-testharness-server` (alias `sts`):

```bash
# Start the adapter with default ports (8000/8001)
sdk-testharness-server adapter

# Override ports via environment variables
ADAPTER_REST_PORT=9000 ADAPTER_WS_PORT=9001 sdk-testharness-server adapter
```

### Client-side (`"./client"`)

For browser, React Native, and Electron contract tests. Includes all universal exports plus:

```ts
import {
  ClientSideTestHook,
} from '@launchdarkly/js-contract-test-utils/client';
```

- **`ClientSideTestHook`** -- Hook implementation using `fetch()` to report hook execution data back to the test harness.

## Build

```bash
yarn build
```

## Usage in Entity Packages

### Browser / React Native / Electron (client-side)

```ts
import {
  ClientSideTestHook,
  CommandParams,
  makeLogger,
} from '@launchdarkly/js-contract-test-utils/client';
```

### Universal types and utilities

```ts
import {
  ClientPool,
  makeLogger,
  CommandType,
} from '@launchdarkly/js-contract-test-utils';

const pool = new ClientPool<MyClientEntity>();
const id = pool.nextId();
pool.add(id, entity);
```

## Architecture

```
contract-test-utils/
  src/
    adapter/
      AdapterOptions.ts           # Adapter configuration interface
      startAdapter.ts             # REST↔WebSocket bridge server
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
