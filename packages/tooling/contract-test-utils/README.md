# @launchdarkly/js-contract-test-utils

Shared utilities for LaunchDarkly JavaScript SDK contract tests. This package consolidates duplicated contract test code across the browser, React Native, Electron, server-node, and Shopify Oxygen SDKs.

This is a **private** package (not published to npm) used only within this monorepo.

## CLI

The package provides a CLI executable for running contract test infrastructure:

```bash
# Full name
sdk-testharness-server <command>

# Alias
sts <command>
```

### Commands

#### `adapter`

Starts the REST-to-WebSocket adapter server. This bridges the HTTP REST-based test harness protocol to a WebSocket connection for browser-like environments (browser, React Native, etc.).

The adapter runs two servers:
1. A **WebSocket server** (default port `8001`) that the entity (browser/RN app) connects to
2. An **HTTP REST server** (default port `8000`) that the test harness sends commands to

```bash
sdk-testharness-server adapter
```

### Configuration

The CLI loads configuration from a `contract-test.config` file in the current working directory. Supported formats (searched in this order):

- `contract-test.config.json`
- `contract-test.config.js`
- `contract-test.config.mjs`
- `contract-test.config.cjs`
- `contract-test.config.ts` (requires Node.js >= 22 or a loader like `tsx`)
- `contract-test.config.mts`

If no config file is found, defaults are used.

**Example `contract-test.config.json`:**

```json
{
  "adapter": {
    "wsPort": 8001,
    "httpPort": 8000
  }
}
```

**Example typed config (`contract-test.config.ts`):**

```ts
import type { ContractTestConfig } from '@launchdarkly/js-contract-test-utils/adapter';

const config: ContractTestConfig = {
  adapter: {
    wsPort: 8001,
    httpPort: 8000,
  },
};

export default config;
```

## Subpath Exports

The package uses subpath exports to organize code by platform:

| Import Path | Contents | Resolution |
|---|---|---|
| `@launchdarkly/js-contract-test-utils` | Universal types, logging, `ClientPool` | Source `.ts` (for bundlers) |
| `@launchdarkly/js-contract-test-utils/client` | Client-side `TestHook`, `TestHarnessWebSocket` | Source `.ts` (for bundlers) |
| `@launchdarkly/js-contract-test-utils/server` | Server-side `TestHook` | Compiled `dist/` (for Node.js) |
| `@launchdarkly/js-contract-test-utils/adapter` | `startAdapter()`, `ContractTestConfig` type | Compiled `dist/` (for Node.js) |

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

### Client-side (`"./client"`)

For browser, React Native, and Electron contract tests. Includes all universal exports plus:

```ts
import {
  ClientSideTestHook,
  TestHarnessWebSocket,
} from '@launchdarkly/js-contract-test-utils/client';
```

- **`TestHarnessWebSocket`** -- Manages the WebSocket dispatch loop between the adapter and the entity. Constructed with a URL, capabilities list, and a factory function for creating client entities.
- **`ClientSideTestHook`** -- Hook implementation using `fetch()` to report hook execution data back to the test harness.

### Server-side (`"./server"`)

For server-node and Shopify Oxygen contract tests. Includes all universal exports plus:

```ts
import {
  ServerSideTestHook,
  ClientPool,
} from '@launchdarkly/js-contract-test-utils/server';
```

- **`ServerSideTestHook`** -- Hook implementation using `got` for HTTP requests.
- **`ClientPool<T>`** -- Generic pool for managing client entity lifecycles (`add`, `get`, `remove`, `nextId`).

### Adapter (`"./adapter"`)

For the REST-to-WebSocket bridge used by browser and React Native adapters:

```ts
import { startAdapter } from '@launchdarkly/js-contract-test-utils/adapter';
import type { ContractTestConfig, AdapterOptions } from '@launchdarkly/js-contract-test-utils/adapter';
```

## Build Scripts

```bash
# Full build (all outputs)
yarn build

# Server-side only (for server-node contract tests)
yarn build:server

# Adapter + CLI only (for browser/RN adapter packages)
yarn build:adapter
```

## Usage in Adapter Packages

Browser and React Native adapter packages delegate entirely to the CLI:

```json
{
  "scripts": {
    "build": "yarn workspace @launchdarkly/js-contract-test-utils build:adapter",
    "start": "yarn build && sdk-testharness-server adapter"
  },
  "dependencies": {
    "@launchdarkly/js-contract-test-utils": "workspace:*"
  }
}
```

No local source code or TypeScript configuration is needed -- the adapter package is just a thin wrapper that invokes the shared CLI.

## Usage in Entity Packages

### Browser / React Native / Electron (client-side)

```ts
import {
  TestHarnessWebSocket,
  ClientSideTestHook,
  CommandParams,
  makeLogger,
} from '@launchdarkly/js-contract-test-utils/client';

const ws = new TestHarnessWebSocket(
  'ws://localhost:8001',
  ['client-side', 'mobile', 'service-endpoints', /* ... */],
  async (config) => createClientEntity(config),
);
ws.connect();
```

### Server-node / Shopify Oxygen (server-side)

```ts
import {
  ServerSideTestHook,
  ClientPool,
  makeLogger,
} from '@launchdarkly/js-contract-test-utils/server';

const pool = new ClientPool<MyClientEntity>();
const id = pool.nextId();
pool.add(id, entity);
```

## Architecture

```
contract-test-utils/
  src/
    bin/
      sdk-testharness-server.ts   # CLI entry point
      loadConfig.ts               # Config file loader
    adapter/
      startAdapter.ts             # REST-to-WebSocket bridge
    client-side/
      TestHook.ts                 # fetch()-based hook reporting
      TestHarnessWebSocket.ts     # WebSocket dispatch loop
    server-side/
      TestHook.ts                 # got-based hook reporting
      ClientPool.ts               # Generic entity pool
    logging/
      makeLogger.ts               # Logger factory
    types/
      CommandParams.ts            # Command/response type definitions
      ConfigParams.ts             # SDK configuration type definitions
      ContractTestConfig.ts       # CLI config file type
      compat.ts                   # Minimal cross-SDK type aliases
    index.ts                      # Universal exports
    client.ts                     # Client-side exports
    server.ts                     # Server-side exports
    adapter.ts                    # Adapter exports
```
