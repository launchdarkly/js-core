# @launchdarkly/js-contract-test-utils

Shared utilities for LaunchDarkly JavaScript SDK contract tests. This package provides universal types, logging utilities, and a client-side test hook that are used across multiple SDK contract test implementations.

This is a **private** package (not published to npm) used only within this monorepo.

## Subpath Exports

The package uses subpath exports to organize code by platform:

| Import Path | Contents | Resolution |
|---|---|---|
| `@launchdarkly/js-contract-test-utils` | Universal types, logging, `ClientPool` | Source `.ts` (for bundlers) |
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
    client.ts                     # Client-side exports
```
