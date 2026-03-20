# Migrating from `launchdarkly-react-client-sdk` v3 to `@launchdarkly/react-sdk`

This document describes the API differences between the legacy `launchdarkly-react-client-sdk` (v3.x)
and the new `@launchdarkly/react-sdk` package.

With the introduction of server components, we will narrow our official React support to a minimum major version of **18** (peer dependency: `react@>=18.0.0`). Support for React Server Components is experimental and may require React 18 or later.

---

## Hooks

### `useLDClient` — unchanged

```ts
// Before
import { useLDClient } from 'launchdarkly-react-client-sdk';
const client = useLDClient();

// After
import { useLDClient } from '@launchdarkly/react-sdk';
const client = useLDClient();
```

Both return the `LDClient` instance. Use the client directly for `identify()`, `track()`, etc.

---

### `useLDClientError` → `useInitializationStatus` (replacement)

The old `useLDClientError()` only returned an error when the client failed to initialize.
The new `useInitializationStatus()` provides both the full initialization state **and** the error.

```ts
// Before
import { useLDClientError } from 'launchdarkly-react-client-sdk';
const error = useLDClientError(); // Error | undefined

// After
import { useInitializationStatus } from '@launchdarkly/react-sdk';
const { status, error } = useInitializationStatus();
// status: 'unknown' | 'initializing' | 'complete' | 'timeout' | 'failed'
// error: Error | undefined (only present when status === 'failed')
```

`useInitializationStatus` is strictly more capable: it tells you the full state of initialization,
not just whether there was an error. Use `status` to gate rendering and `error` for error reporting.

`useInitializationStatus` is also the replacement for `asyncWithLDProvider`. The old function blocked
rendering until the client initialized. In the new SDK, the provider renders immediately and you use
`useInitializationStatus` to conditionally render loading or error states yourself:

```tsx
// Before — asyncWithLDProvider blocked until flags were ready
const LDProvider = await asyncWithLDProvider({ clientSideID: 'your-id' });
root.render(<LDProvider><App /></LDProvider>);

// After — provider renders immediately; gate your UI with useInitializationStatus
const LDProvider = createLDReactProvider('your-client-side-id', { kind: 'user', key: 'user-key' });

function App() {
  const { status, error } = useInitializationStatus();
  if (status === 'initializing' || status === 'unknown') return <LoadingSpinner />;
  if (status === 'failed') return <ErrorMessage error={error} />;
  return <YourApp />;
}

root.render(<LDProvider><App /></LDProvider>);
```

---

### `useBoolVariation` / `useStringVariation` / `useNumberVariation` / `useJsonVariation`

Typed single-flag hooks that re-render only when that specific flag changes. These are the
recommended hooks for evaluating individual flags — explicitly typed, with no generic type
parameter needed. The naming convention aligns with the LaunchDarkly React Native SDK and other
LaunchDarkly SDKs, making the API consistent across platforms.

```ts
import {
  useBoolVariation,
  useStringVariation,
  useNumberVariation,
  useJsonVariation,
} from '@launchdarkly/react-sdk';

const showNewFeature = useBoolVariation('show-new-feature', false);
const theme          = useStringVariation('ui-theme', 'light');
const maxItems       = useNumberVariation('max-items', 10);
const config         = useJsonVariation('my-config', {});
```

Each hook is more efficient than `useFlags()` when you only care about one flag, because it
subscribes to `change:<key>` instead of the broad `change` event.

---

### `useBoolVariationDetail` / `useStringVariationDetail` / `useNumberVariationDetail` / `useJsonVariationDetail`

Typed single-flag hooks that return the full evaluation detail (`value`, `variationIndex`,
`reason`), re-rendering only when that specific flag changes:

```ts
import { useBoolVariationDetail } from '@launchdarkly/react-sdk';

const { value, variationIndex, reason } = useBoolVariationDetail('show-new-feature', false);
```

Use these when you need the evaluation reason (e.g. to understand why a flag returned a particular
value) without subscribing to every flag change.

---

### `useFlags` — deprecated

> **Deprecated.** Use individual typed variation hooks (`useBoolVariation`, etc.) or `useLDClient`
> instead. This hook will be removed in a future major version.

---

## Provider setup

### Old SDK: `withLDProvider` / `asyncWithLDProvider`

The old SDK provided Higher-Order Components (HOCs) to wrap your app.

### New SDK: `createLDReactProvider` / `createLDReactProviderWithClient`

The new SDK uses factory functions that return a React component. There are no HOCs.

**Convenience factory (recommended):**

```tsx
// Before
import { withLDProvider } from 'launchdarkly-react-client-sdk';
export default withLDProvider({ clientSideID: 'your-id', context: { kind: 'user', key: 'user-key' } })(App);

// After — convenience factory (creates the client internally, auto-starts by default)
import { createLDReactProvider } from '@launchdarkly/react-sdk';
const LDProvider = createLDReactProvider('your-client-side-id', { kind: 'user', key: 'user-key' });

function Root() {
  return (
    <LDProvider>
      <App />
    </LDProvider>
  );
}
```

**Low-level API (when you need the client instance directly):**

```tsx
// If you need to hold a reference to the client before mounting:
import { createClient, createLDReactProviderWithClient } from '@launchdarkly/react-sdk';

const client = createClient('your-client-side-id', { kind: 'user', key: 'user-key' });
client.start(); // you are responsible for calling start()
const LDProvider = createLDReactProviderWithClient(client);
```

`createLDReactProvider` calls `client.start()` before the provider mounts and updates React
state when initialization completes or when `client.identify()` is called.
`createLDReactProviderWithClient` does NOT auto-start — the caller owns the client lifecycle.

---

## `deferInitialization`

| | Old SDK (`launchdarkly-react-client-sdk` v3) | New SDK (`@launchdarkly/react-sdk`) |
|---|---|---|
| Option location | `withLDProvider({ deferInitialization })` | `createLDReactProvider(id, ctx, { deferInitialization })` |
| Default | `false` (auto-initialize on mount) | `false` (auto-start before provider mounts) |
| When `true` | Provider does not call `initialize()`; user calls `ldClient.identify(context)` to start | Factory does not call `start()`; user must call `client.start()` manually |
| How to start manually | `ldClient.identify(context)` — identify doubled as init in the old SDK | `client.start()` — explicit start required; `identify()` switches context only after `start()` |

`createLDReactProviderWithClient` (the low-level API) always behaves as if
`deferInitialization: true` — it never calls `start()` automatically.

---

## Removed APIs

| Old API | Status | Replacement |
|---------|--------|-------------|
| `useLDClientError()` | Removed | `useInitializationStatus().error` |
| `useFlag()` | Removed | `useBoolVariation`, `useStringVariation`, `useNumberVariation`, `useJsonVariation` |
| `useFlagDetail()` | Removed | `useBoolVariationDetail`, `useStringVariationDetail`, `useNumberVariationDetail`, `useJsonVariationDetail` |
| `withLDProvider()` | Removed | `createLDReactProvider()` |
| `asyncWithLDProvider()` | Removed | `createLDReactProvider()` |
| `withLDConsumer()` | Removed | `useLDClient()`, typed variation hooks (`useBoolVariation`, etc.) |
| `LDProvider` component | Removed | `createLDReactProvider()` |

---

## Multiple environments

The new SDK supports multiple LaunchDarkly environments in the same React tree. Each environment
gets its own React context, provider, and client — hooks then read from whichever context you pass.

```tsx
// environments.ts — single module, import anywhere in your app
import {
  initLDReactContext,
  createClient,
  createLDReactProviderWithClient,
} from '@launchdarkly/react-sdk';

export const ProdLDContext    = initLDReactContext();
export const StagingLDContext = initLDReactContext();

const prodClient    = createClient('prod-client-side-id',    { kind: 'user', key: 'user-key' });
const stagingClient = createClient('staging-client-side-id', { kind: 'user', key: 'user-key' });
prodClient.start();
stagingClient.start();

export const ProdLDProvider    = createLDReactProviderWithClient(prodClient,    ProdLDContext);
export const StagingLDProvider = createLDReactProviderWithClient(stagingClient, StagingLDContext);
```

```tsx
// Root.tsx
function Root() {
  return (
    <ProdLDProvider>
      <StagingLDProvider>
        <App />
      </StagingLDProvider>
    </ProdLDProvider>
  );
}
```

```tsx
// In any component
import { useBoolVariation } from '@launchdarkly/react-sdk';
import { ProdLDContext, StagingLDContext } from './environments';

function MyComponent() {
  const showInProd    = useBoolVariation('my-feature', false, ProdLDContext);
  const showInStaging = useBoolVariation('my-feature', false, StagingLDContext);
  // ...
}
```

Each client's lifecycle (including `identify()`) is independent — call it on each client when
the user context changes.

---

## Named contexts

The old SDK supported custom React contexts via `withLDProvider({ reactContext })` and
`withLDConsumer({ reactContext })`. The new SDK exposes the same capability through the
`reactContext` option on `createLDReactProvider` and through the optional argument on every hook.

```tsx
// Before
import { withLDProvider, withLDConsumer } from 'launchdarkly-react-client-sdk';
const MyContext = React.createContext(null);

export default withLDProvider({
  clientSideID: 'your-id',
  reactContext: MyContext,
})(App);

const MyComponent = withLDConsumer({ reactContext: MyContext })(({ flags, ldClient }) => (
  <div>{flags.myFlag ? 'on' : 'off'}</div>
));

// After
import { initLDReactContext, createLDReactProvider, useBoolVariation, useLDClient } from '@launchdarkly/react-sdk';

const MyContext = initLDReactContext();
const LDProvider = createLDReactProvider('your-id', { kind: 'user', key: 'user-key' }, {
  reactContext: MyContext,
});

function MyComponent() {
  const myFlag   = useBoolVariation('my-flag', false, MyContext);
  const ldClient = useLDClient(MyContext);
  return <div>{myFlag ? 'on' : 'off'}</div>;
}
```
