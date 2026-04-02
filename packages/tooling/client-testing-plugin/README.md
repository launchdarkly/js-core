# LaunchDarkly Client Testing Plugin

A testing plugin for LaunchDarkly client-side JavaScript SDKs. Use it to inject deterministic flag values into a real SDK client during unit tests, integration tests, and local development — no LaunchDarkly account or network connection required.

> **Experimental.** This plugin is built on the experimental `registerDebug` plugin hook from the [PLUGIN spec](https://github.com/launchdarkly/sdk-specs/blob/main/specs/PLUGIN-sdk-plugin-support/README.md), which is currently intended for use by LaunchDarkly tooling. The hook may change in future SDK versions.

## How it works

`TestData` registers as an `LDPlugin`. When the SDK initializes, it hands the plugin an `LDDebugOverride` interface, which the plugin uses to set flag values that take precedence over real LaunchDarkly data.

This means you get the **real SDK client** (real evaluation events, real change emitter, real `allFlags()`, real `variation()`) with synthetic flag values you control.

## Install

```bash
yarn add --dev @launchdarkly/client-testing-plugin @launchdarkly/js-client-sdk
```

## Usage

```ts
import { createClient } from '@launchdarkly/js-client-sdk';
import { TestData } from '@launchdarkly/client-testing-plugin';

const td = new TestData();
td.update(td.flag('new-ui').booleanFlag().variationForAll(true));
td.update(td.flag('greeting').valueForAll('Hello!'));

const client = createClient(
  '<ldClientSideId>', // placeholder — fill in only for real environments
  { kind: 'user', key: 'tester' },
  {
    plugins: [td],
    sendEvents: false,
    streaming: false,
  },
);

await client.start({ bootstrap: {} });

client.boolVariation('new-ui', false); // true
client.stringVariation('greeting', '(default)'); // 'Hello!'

// Update flags at any time — the SDK fires change events.
td.update(td.flag('new-ui').booleanFlag().variationForAll(false));
```

### Why these options matter

- **`plugins: [td]`** — registers the testing plugin so it can inject overrides.
- **`sendEvents: false`** — keeps analytics events off in tests.
- **`streaming: false`** — prevents the SDK from auto-starting a streaming connection when a `change` listener is registered. Without this, frameworks like `LDProvider` from `@launchdarkly/react-sdk` will trigger a real network call to `clientstream.launchdarkly.com`.
- **`bootstrap: {}` (passed to `start()`)** — gives the SDK an empty initial flag set so it does not block on a network identify call. The plugin's overrides are applied immediately afterward.

If you forget any of these, the SDK may attempt to fetch flags from LaunchDarkly during initialization and produce real network traffic, console errors, or stray evaluation events.

## API

### `TestData`

```ts
class TestData implements LDPlugin {
  flag(key: string): TestDataFlagBuilder;
  update(builder: TestDataFlagBuilder): void;
  removeFlag(key: string): void;
  clear(): void;
}
```

- `flag(key)` — start (or copy) a builder for the given flag key.
- `update(builder)` — install the configured flag value. If the SDK is already running, the change propagates immediately and listeners receive a `change:<key>` event. Identical primitive values are deduplicated; object/array values always propagate so that in-place mutations are not silently dropped.
- `removeFlag(key)` — drop the override for a single key.
- `clear()` — drop all overrides. Useful in `beforeEach` for shared `TestData` instances.

### `TestDataFlagBuilder`

The builder produces a single resolved flag value. Because client-side SDKs receive pre-evaluated values, the builder API is intentionally simpler than the server-side `TestData` (no rules, segments, or per-context targeting).

- `booleanFlag()` — shorthand for two boolean variations (`[true, false]`) with fallthrough `true` and off `false`.
- `stringFlag(value)` — shorthand: serve a single string value to all contexts.
- `numberFlag(value)` — shorthand: serve a single numeric value to all contexts.
- `jsonFlag(value)` — shorthand: serve a single JSON object or array to all contexts.
- `variations(...values)` — set the list of possible values.
- `on(boolean)` — toggle whether the flag returns a fallthrough variation or off variation.
- `fallthroughVariation(index)` — pick which variation index is returned when on.
- `offVariation(index)` — pick which variation index is returned when off.
- `variationForAll(value)` — boolean flag shortcut: serve `value` to all contexts.
- `valueForAll(value)` — serve a single arbitrary value to all contexts (works for both on and off states).

### Flag kinds

LaunchDarkly flags have five kinds, matching the [`EnhancedFlag.type`](https://github.com/launchdarkly/launchdarkly-toolbar) enum used by the LaunchDarkly toolbar (`'boolean' | 'string' | 'number' | 'object' | 'multivariate'`) and the LD API's `ApiFlag.kind`. The plugin's override path is type-agnostic — `setOverride(flagKey, value)` accepts any value — so the typed builder helpers below exist purely for TypeScript ergonomics. `valueForAll(value)` remains the universal escape hatch.

```ts
// Boolean
td.update(td.flag('show-banner').booleanFlag().variationForAll(true));

// String
td.update(td.flag('greeting').stringFlag('Hello!'));

// Number
td.update(td.flag('max-retries').numberFlag(3));

// Object (JSON object or array)
td.update(td.flag('config').jsonFlag({ theme: 'dark', density: 'compact' }));

// Multivariate (use the builder directly — no shorthand)
td.update(
  td.flag('button-color')
    .variations('red', 'green', 'blue')
    .on(true)
    .fallthroughVariation(1),
);
```

## Test isolation

Each `TestData` instance must be paired with at most one client. Re-registering a `TestData` with a second client throws.

For test suites that share a single `TestData` across `it()` blocks, call `td.clear()` in `beforeEach` to avoid bleed-over from prior tests:

```ts
let td: TestData;
beforeEach(() => {
  td = new TestData();
});
// or
beforeEach(() => {
  td.clear();
});
```

## React testing

Use the testing plugin with `LDProvider` from `@launchdarkly/react-sdk`:

```tsx
import { createClient } from '@launchdarkly/js-client-sdk';
import { LDProvider } from '@launchdarkly/react-sdk';
import { TestData } from '@launchdarkly/client-testing-plugin';

const td = new TestData();
td.update(td.flag('show-banner').booleanFlag().variationForAll(true));

const client = createClient(
  '<ldClientSideId>',
  { kind: 'user', key: 'tester' },
  { plugins: [td], sendEvents: false, streaming: false },
);
await client.start({ bootstrap: {} });

render(
  <LDProvider client={client}>
    <YourComponent />
  </LDProvider>,
);
```

The `streaming: false` option is especially important here because `LDProvider` registers internal `change` listeners, which would otherwise auto-start a real streaming connection.

## Status & limitations

- Built on the experimental `registerDebug` plugin hook (PLUGIN spec 1.1.7). Track the spec for changes.
- Override descriptors carry no variation index or evaluation reason — `variationDetail()` reflects the override value but its reason is not a real targeting reason.
- During SDK construction, pre-configured flags are replayed via `setOverride` before the first `identify`, which currently logs one "Received a change event without an active context" warning per flag in the SDK logger. This is cosmetic; the override values are correctly stored and resolved.
- The "no network" guarantee assumes the default FDv1 data path. If you opt into FDv2 via `dataSystem`, the SDK still starts the configured synchronizers regardless of `bootstrap: {}`. For FDv2, configure `dataSystem` so that no synchronizers are active — or stay on FDv1 for tests.
- Designed for **client-side** SDKs only (Browser, Electron, React Native). For server-side testing, use the server-side `TestData` data source.
- Not intended for production use.
