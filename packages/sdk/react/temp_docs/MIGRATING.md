# Migrating from `launchdarkly-react-client-sdk` v3 to `@launchdarkly/react-sdk`

This document describes the API differences between the legacy `launchdarkly-react-client-sdk` (v3.x)
and the new `@launchdarkly/react-sdk` package.

---

## Hooks

### `useFlags` — unchanged

```ts
// Before
import { useFlags } from 'launchdarkly-react-client-sdk';
const flags = useFlags();

// After
import { useFlags } from '@launchdarkly/react-sdk';
const flags = useFlags();
```

Both return all current flag values as a plain object. The hook re-renders whenever any flag value changes.

---

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
const client = createClient('your-client-side-id', { kind: 'user', key: 'user-key' });
const LDProvider = createLDReactProvider(client);

function App() {
  const { status, error } = useInitializationStatus();
  if (status === 'initializing' || status === 'unknown') return <LoadingSpinner />;
  if (status === 'failed') return <ErrorMessage error={error} />;
  return <YourApp />;
}

root.render(<LDProvider><App /></LDProvider>);
```

---

### `useFlag` — new hook (no equivalent in v3)

A new typed single-flag hook that re-renders only when that specific flag changes:

```ts
import { useFlag } from '@launchdarkly/react-sdk';

const showNewFeature = useFlag<boolean>('show-new-feature', false);
const maxItems = useFlag<number>('max-items', 10);
```

This is more efficient than `useFlags()` when you only care about one flag, because it subscribes
to `change:<key>` instead of the broad `change` event.

---

### `useFlagDetail` — new hook (no equivalent in v3)

Returns the full evaluation detail (`value`, `variationIndex`, `reason`) for a single flag, also
re-rendering only when that specific flag changes:

```ts
import { useFlagDetail } from '@launchdarkly/react-sdk';

const { value, variationIndex, reason } = useFlagDetail<boolean>('show-new-feature', false);
```

Use this when you need the evaluation reason (e.g. to understand why a flag returned a particular
value) without subscribing to every flag change.

---

## Provider setup

### Old SDK: `withLDProvider` / `asyncWithLDProvider`

The old SDK provided Higher-Order Components (HOCs) to wrap your app.

### New SDK: `createLDReactProvider`

The new SDK uses a factory function that returns a React component. There are no HOCs.

```tsx
// Before
import { withLDProvider } from 'launchdarkly-react-client-sdk';
export default withLDProvider({ clientSideID: 'your-id' })(App);

// After
import { createClient, createLDReactProvider } from '@launchdarkly/react-sdk';

const client = createClient('your-client-side-id', { kind: 'user', key: 'user-key' });
const LDProvider = createLDReactProvider(client);

function Root() {
  return (
    <LDProvider>
      <App />
    </LDProvider>
  );
}
```

The provider automatically calls `client.start()` on mount and updates React state when
initialization completes or when `client.identify()` is called.

---

## Removed APIs

| Old API | Status | Replacement |
|---------|--------|-------------|
| `useLDClientError()` | Removed | `useInitializationStatus().error` |
| `withLDProvider()` | Removed | `createLDReactProvider()` |
| `asyncWithLDProvider()` | Removed | `createLDReactProvider()` |
| `withLDConsumer()` | Removed | `useLDClient()`, `useFlags()` hooks |
| `LDProvider` component | Removed | `createLDReactProvider()` |

---

## Multiple client instances

The new SDK supports multiple LaunchDarkly clients in the same React tree via React context.
Pass a custom context to hooks and providers:

```tsx
import { initLDReactContext, createLDReactProvider, useFlags } from '@launchdarkly/react-sdk';

const MyLDContext = initLDReactContext();
const LDProvider = createLDReactProvider(client, MyLDContext);

function MyComponent() {
  const flags = useFlags(MyLDContext);
  // ...
}
```
