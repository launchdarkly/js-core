# Migrating to this SDK

Below are some breaking changes between this SDK and the previous
[Node Client-Side SDK](https://github.com/launchdarkly/node-client-sdk)
(`launchdarkly-node-client-sdk`).

## Package rename

The package name changed from `launchdarkly-node-client-sdk` to
`@launchdarkly/node-client-sdk`.

```bash
# before
npm uninstall launchdarkly-node-client-sdk
# after
npm install @launchdarkly/node-client-sdk
```

Update any imports:

```diff
- import { initialize } from 'launchdarkly-node-client-sdk';
+ import { createClient } from '@launchdarkly/node-client-sdk';
```

## SDK initialization (createClient and start)

The entry point is now **`createClient`** (replacing `initialize`). Update
any references accordingly.

- **New signature:** `createClient(envKey, initialContext, options)` -- the
  initial context is required as the second argument.

- **Must call `start()`:** The client is no longer ready when `createClient`
  returns. After `createClient()`, the app must call `client.start()`
  (optionally with `LDStartOptions`: `timeout`, `bootstrap`,
  `identifyOptions`). The promise returned by `start()` resolves when the
  first identify completes (or times out, or fails).

- **No `identify()` before `start()`:** Calling `identify()` before
  `start()` is an error (logged and rejected). Use `identify()` only after
  `start()` has been called, for subsequent context changes.

Example:

```typescript
const client = createClient(clientSideId, initialContext, options);
await client.start();
// Later, when changing context:
await client.identify(newContext);
```

## Identify flow (identify returns result, does not throw)

`identify()` now returns a promise that **always resolves** to an
`LDIdentifyResult` object. It does **not** throw; success or failure is
indicated by the resolved value.

- **Return type:** `Promise<LDIdentifyResult>`
- **Result statuses:**
  - `{ status: 'completed' }` -- identification succeeded.
  - `{ status: 'error', error: Error }` -- identification failed.
  - `{ status: 'timeout', timeout: number }` -- identification did not
    complete within the configured timeout.
  - `{ status: 'shed' }` -- the identify was shed (e.g. when using
    `sheddable: true` and a newer identify superseded it).

Before (throwing):

```typescript
try {
  await client.identify(newContext);
  // success
} catch (err) {
  // handle error or timeout
}
```

After (result object):

```typescript
const result = await client.identify(newContext);
if (result.status === 'completed') {
  // success
} else if (result.status === 'error') {
  // result.error
} else if (result.status === 'timeout') {
  // result.timeout (seconds)
}
```

You can still `await client.identify(context)` without inspecting the
result if you do not need to handle errors or timeouts explicitly.

## Evaluation, identify, and track hooks

The SDK now supports lifecycle hooks. A hook can attach to one or more
stages: `beforeEvaluation` / `afterEvaluation` (variation calls),
`beforeIdentify` / `afterIdentify` (`identify()` calls), and
`afterTrack` (`track()` calls). Hooks can carry state from a before
stage into the matching after stage.

```typescript
import type { Hook } from '@launchdarkly/node-client-sdk';

const timingHook: Hook = {
  getMetadata: () => ({ name: 'timing' }),
  beforeEvaluation: (ctx, data) => ({ ...data, start: Date.now() }),
  afterEvaluation: (ctx, data, detail) => {
    metrics.recordVariationLatency(ctx.flagKey, Date.now() - data.start);
    return data;
  },
};

const client = createClient(envKey, initialContext, {
  hooks: [timingHook],
});
```

Hooks can also be registered after `createClient` via `client.addHook(hook)`.

## Inspectors

Inspectors are a lower-level monitoring mechanism for flag usage and flag
state changes. They are now exposed through the `inspectors` option.

```typescript
const client = createClient(envKey, initialContext, {
  inspectors: [
    {
      type: 'flag-used',
      name: 'log-evaluations',
      method: (flagKey, detail, context) => {
        console.log(`flag ${flagKey} = ${detail.value} for ${context.key}`);
      },
    },
  ],
});
```

Inspectors are deprecated and will be removed in a future release; new
code should use hooks instead. Inspectors remain supported for now to
ease migration for consumers that already use them.

## Plugins and application metadata

The SDK supports a plugin extension surface. Plugins receive a metadata
object describing the SDK and the host application, including the optional
`applicationInfo`.

```typescript
import type { LDPlugin } from '@launchdarkly/node-client-sdk';

const tracingPlugin: LDPlugin = {
  getMetadata: () => ({ name: 'tracing' }),
  register: (client, environmentMetadata) => {
    // wire up tracing using environmentMetadata.sdk + environmentMetadata.application
  },
};

const client = createClient(envKey, initialContext, {
  applicationInfo: {
    id: 'my-app',
    version: '1.2.3',
  },
  plugins: [tracingPlugin],
});
```

Plugin support is experimental and subject to change.

## Runtime connection-mode control

The SDK starts in the mode specified by `initialConnectionMode`
(default: `streaming`). The mode can be changed at runtime via
`setConnectionMode`, and the current mode read back via
`getConnectionMode`. Valid modes are `offline`, `streaming`, and
`polling`.

```typescript
const client = createClient(envKey, initialContext, {
  initialConnectionMode: 'streaming',
});
await client.start();

await client.setConnectionMode('offline'); // disconnect from LD
await client.setConnectionMode('polling'); // resume in polling mode
```

The previous SDK had no runtime control over connection mode; it was
configuration-only.

## TLS configuration

TLS parameters are now configured via the `tlsParams` option, which
accepts the same fields as Node's `https.request()`.

```typescript
import * as fs from 'fs';

const client = createClient(envKey, initialContext, {
  tlsParams: {
    ca: fs.readFileSync('/etc/ssl/custom-ca.pem'),
    rejectUnauthorized: true,
  },
});
```

Supported fields include `ca`, `cert`, `key`, `pfx`, `passphrase`,
`ciphers`, `rejectUnauthorized`, `secureProtocol`, `servername`, and
`checkServerIdentity`.

## Minimum Node version

Node `>=18` is now required. The previous SDK supported Node `>=12`. Native
`fetch` and `crypto.randomUUID` are now used internally so the SDK no
longer depends on `node-fetch` or polyfills.

## Persistent cache format

The on-disk cache used by anonymous-key persistence and last-known flag
values changed format.

- The previous SDK stored entries via `node-localstorage` -- one file per
  key inside `<localStoragePath>/ldclient-user-cache/`.
- This SDK stores all entries in a single `<localStoragePath>/ldclient-user-cache/ldcache.json`
  file with atomic temp-then-rename writes.

The default location (`<cwd>/ldclient-user-cache`) is unchanged, but
existing v3 cache data will not be read. The next anonymous identify will
generate a fresh anonymous key; existing flag values will repopulate from
the network on the next sync.

If you want to clear out the old cache directory before upgrading, delete
the per-key files inside `<cwd>/ldclient-user-cache/` (or the path you
configured) before starting the new SDK.

## Removed dependencies

- `node-localstorage` -- replaced by an in-tree fs-backed implementation.
- `launchdarkly-eventsource` is still used internally; no caller-visible
  change.
