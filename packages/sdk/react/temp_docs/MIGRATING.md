# Migrating from `launchdarkly-react-client-sdk` v3 to `@launchdarkly/react-sdk` v4

This document describes the API differences between the legacy `launchdarkly-react-client-sdk` (v3.x)
and the new `@launchdarkly/react-sdk` package.

With the introduction of server components, we will narrow our official React support to a minimum major version of **18** (peer dependency: `react@>=18.0.0`).
This SDK supports React server components in `@launchdarkly/react-sdk/server` submodule. It is important to note that React server components are stabilized
in React 19 and are only stable in a handful of frameworks (as of the time of writing), so you **MUST** be on React 19 to leverage the server submodule.
Otherwise, being in an earlier version of React **SHOULD** work if you are only using the `@launchdarkly/react-sdk`.

NOTE: the new React SDK is based on `@launchdarkly/js-client-sdk` which is our JavaScript SDK at version >= 4.0.0. Please also read the differences
between that version and the older versions of the JavaScript SDK as those changes are also relevant to the React SDK.
> https://launchdarkly.com/docs/sdk/client-side/javascript/migration-3-to-4
---
## Package name and location

Globally, we've changed our package from `launchdarkly-react-client-sdk` to `@launchdarkly/react-sdk`. The reasoning is:
1. Scoped packages are easier to manage
2. We moved the implementation into our `js-core` monorepo which makes downstream dependencies much easier to manage
3. We took the `client` out of the name as we are also supporting server side rendering with this major version release

---

## Hooks

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
// status: 'initializing' | 'complete' | 'timeout' | 'failed'
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
  if (status === 'initializing') return <LoadingSpinner />;
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

The `useFlags` hook is still available to use, but it is deprecated. We strongly recommend using our typed
variation hooks for flag evaluations. If you must have a `allFlag` output then you can call `allFlags` directly
from the LDClient:

```ts
import { useLDClient } from '@launchdarkly/react-sdk';

const ldClient = useLDClient();
const flags = ldClient.allFlags();
```

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

## Bootstrap

### Old SDK

Bootstrap data was passed nested inside `options`:

```tsx
// HOC
withLDProvider({ clientSideID: 'your-id', options: { bootstrap: myData } })(App);

// Async HOC
const LDProvider = await asyncWithLDProvider({ clientSideID: 'your-id', options: { bootstrap: myData } });
```

### New SDK

Bootstrap is a top level option on `createLDReactProvider`:

```tsx
import { createLDReactProvider } from '@launchdarkly/react-sdk';

const LDProvider = createLDReactProvider('your-client-side-id', { kind: 'user', key: 'user-key' }, {
  bootstrap: myData,
});
```

The `bootstrap` data format is unchanged from the old SDK. You can pass either a plain key-value
object (`{ 'my-flag': true }`) or the output of `allFlagsState().toJSON()`, which includes
`$flagsState` and `$valid` metadata.

---

## React server component support

> **New in `@launchdarkly/react-sdk`.**

### `createLDServerSession` (recommended)

Creates a per-request evaluation scope by binding a server SDK client to a specific context.
The session is cached using React's `cache()` API, so each request gets its own isolated instance.
This also enables `useLDServerSession()` to retrieve the session from nested Server Components.

```ts
import { init } from '@launchdarkly/node-server-sdk';
import { createLDServerSession } from '@launchdarkly/react-sdk/server';

const ldBaseClient = init(process.env.LAUNCHDARKLY_SDK_KEY!);

// In your root Server Component (e.g. app/layout.tsx or app/page.tsx)
export default async function Page() {
  await ldBaseClient.waitForInitialization({ timeout: 10 });

  const session = createLDServerSession(ldBaseClient, {
    kind: 'user',
    key: 'user-key',
    name: 'Sandy',
  });

  const showFeature = await session.boolVariation('show-new-feature', false);
  return <div>{showFeature ? 'New Feature!' : 'Classic'}</div>;
}
```

### `useLDServerSession`

Retrieves the cached session created by `createLDServerSession` from anywhere in the
Server Component tree. Returns `null` if no session has been created for the current request.

```tsx
// app/page.tsx — create the session in a parent component
import { createLDServerSession } from '@launchdarkly/react-sdk/server';

export default async function Page() {
  await ldBaseClient.waitForInitialization({ timeout: 10 });
  createLDServerSession(ldBaseClient, { kind: 'user', key: 'user-key' });

  return <FeatureBanner />;
}

// components/FeatureBanner.tsx — retrieve it in a nested Server Component
import { useLDServerSession } from '@launchdarkly/react-sdk/server';

export default async function FeatureBanner() {
  const session = useLDServerSession();
  if (!session) return null;

  const banner = await session.stringVariation('banner-text', 'Welcome');
  return <h1>{banner}</h1>;
}
```

### `createLDServerWrapper` (advanced)

Same as `createLDServerSession` but does **not** cache the session. Use this when you need
manual lifecycle control or want to avoid the React `cache()` mechanism.

```ts
import { createLDServerWrapper } from '@launchdarkly/react-sdk/server';

const session = createLDServerWrapper(ldBaseClient, context);
```

> **Note:** Sessions created with `createLDServerWrapper` are not retrievable via
> `useLDServerSession()`. You must pass the session through props or module scope yourself.

### Server-only usage (without client hydration)

If your page is entirely server-rendered and you don't need client-side live updates, you can
use `createLDServerSession` directly without `LDIsomorphicProvider`:

```tsx
// app/dashboard/page.tsx — pure Server Component, no client SDK needed
import { init } from '@launchdarkly/node-server-sdk';
import { createLDServerSession } from '@launchdarkly/react-sdk/server';

const ldBaseClient = init(process.env.LAUNCHDARKLY_SDK_KEY!);

export default async function Dashboard() {
  await ldBaseClient.waitForInitialization({ timeout: 10 });

  const session = createLDServerSession(ldBaseClient, {
    kind: 'user',
    key: 'user-key',
  });

  const maxItems = await session.numberVariation('max-dashboard-items', 5);
  const theme = await session.stringVariation('ui-theme', 'light');

  return (
    <div className={theme}>
      <ItemList limit={maxItems} />
    </div>
  );
}
```

This is simpler than the isomorphic approach but flags will not update until the next
server render (e.g. page navigation or revalidation).

---

## Isomorphic Provider

> **New in `@launchdarkly/react-sdk`.**

`LDIsomorphicProvider` is an async React Server Component that evaluates all flags on the server
and bootstraps the Client-side SDK with those values. This allows the Client-side SDK to start
immediately with real values instead of defaults.

After hydration the client SDK opens a streaming connection and live flag updates propagate
normally to all `useBoolVariation` / `useStringVariation` / etc. hooks.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `session` | `LDServerSession` | Yes | A session created by `createLDServerSession`. Provides the evaluation context and all-flags state. |
| `clientSideId` | `string` | Yes | Your LaunchDarkly client-side ID. |
| `options` | `LDReactProviderOptions` | No | Additional options forwarded to the underlying client provider (e.g. `ldOptions`, `startOptions`, `deferInitialization`, `reactContext`). The `bootstrap` field is overridden automatically. |

### Usage

```tsx
// app/page.tsx (Server Component)
import { init } from '@launchdarkly/node-server-sdk';
import { createLDServerSession, LDIsomorphicProvider } from '@launchdarkly/react-sdk/server';

const ldBaseClient = init(process.env.LAUNCHDARKLY_SDK_KEY!);

export default async function Page() {
  await ldBaseClient.waitForInitialization({ timeout: 10 });

  const session = createLDServerSession(ldBaseClient, {
    kind: 'user',
    key: 'user-key',
    name: 'Sandy',
  });

  return (
    <LDIsomorphicProvider
      session={session}
      clientSideId={process.env.LAUNCHDARKLY_CLIENT_SIDE_ID!}
    >
      <App />
    </LDIsomorphicProvider>
  );
}
```

Server Components inside the provider tree can call `session.boolVariation(...)` directly.
Client Components use the standard hooks (`useBoolVariation`, etc.) — they read from the
bootstrapped data on first render and receive live updates afterwards.

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
