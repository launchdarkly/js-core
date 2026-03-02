# Setting up the LaunchDarkly client context (client-only)

> **Status:** This doc describes the recommended pattern for the React SDK client. The SDK is experimental and the API may change.

## Overview

The React SDK does not use a singleton. Your app creates the LaunchDarkly client and React context in one place by calling `createClient`, `initLDReactContext`, and `createLDReactProvider` from `@launchdarkly/react-sdk`. You then re-export `Provider`, the context, and (optionally) `useLDClient` from that module so the rest of your app imports from a single path (e.g. `@/lib/launchdarkly` or `./LDClient`). The main entry uses `'client-only'`, so the browser client is not bundled for the server.

## Why one file?

- **No singleton:** The SDK does not own a single global client. You can have multiple clients or different configs per environment.
- **You own config:** Client-side ID, initial context, and options are app-specific (often from env or config). That setup lives in your codebase.
- **Single import path:** Once the context and Provider are created and re-exported, every component imports `Provider`, the context, or `useLDClient` from the same module.

## Setup

### 1. Create a single module that creates and re-exports the context

Create a file that will be the single place where the client and context are created. For example `src/LDClient.tsx`, `src/lib/launchdarkly.ts`, or `src/launchdarkly.ts`.

```tsx
import {
  createClient,
  LDContext,
  initLDReactContext,
  createLDReactProvider,
  LDReactClientOptions,
} from '@launchdarkly/react-sdk';

// Your app's config: env, constants, or dynamic values
const clientSideID = process.env.REACT_APP_LD_CLIENT_SIDE_ID ?? '';
const context: LDContext = {
  kind: 'user',
  key: 'user-key',
  name: 'User Name',
};

const options: LDReactClientOptions = {}; // optional

const client = createClient(clientSideID, context, options);
const { context: LDReactContext, useLDClient } = initLDReactContext();
const LDReactProvider = createLDReactProvider(client, LDReactContext);

export { LDReactProvider, LDReactContext, useLDClient };
```

When `createClient` is called on the server (e.g. in a shared module that runs in both environments), it returns a noop client that never instantiates the browser SDK. In the browser it returns a real `LDReactClient`.

Optional: use a path alias (e.g. `@/lib/launchdarkly`) in your bundler/tsconfig so the path is short and stable.

### 2. Wrap the app with `Provider`

At the root of your app (e.g. in `main.tsx`, `App.tsx`, or layout), wrap the tree with the exported `Provider`:

```tsx
import { LDReactProvider } from './LDClient';  // or '@/lib/launchdarkly'

root.render(
  <LDReactProvider>
    <App />
  </LDReactProvider>
);
```

### 3. Use the client in components

Import the context (or `useLDClient`) from the same module and use React's `useContext` to read the client and related state:

```tsx
import { useContext } from 'react';
import { LDReactContext } from './LDClient';  // or '@/lib/launchdarkly'
import type { LDReactClientContextValue } from '@launchdarkly/react-sdk';

function MyComponent() {
  const { client, context, initializedState } = useContext<LDReactClientContextValue>(LDReactContext);
  const isOn = client.boolVariation('my-flag', false);
  return <div>Flag is {isOn ? 'on' : 'off'}</div>;
}
```

Alternatively, use `useLDClient()` from the same module to get the client directly.

## Re-identifying (switching contexts)

Call `client.identify(newContext)` to switch the LaunchDarkly context (e.g. when a user logs in or out). The Provider automatically updates and re-renders the subtree with the new context — no manual state management required.

```tsx
import { useContext } from 'react';
import { LDReactContext } from './LDClient';

function UserSwitcher() {
  const { client, context } = useContext(LDReactContext);

  const handleLogin = () => {
    client.identify({ kind: 'user', key: 'logged-in-user', name: 'Alex' });
  };

  return (
    <div>
      <p>Current context: {context ? JSON.stringify(context) : 'anonymous'}</p>
      <button onClick={handleLogin}>Log in as Alex</button>
    </div>
  );
}
```

After `identify()` resolves, the `context` value in `useContext(LDReactContext)` updates automatically, causing all subscribed components to re-render with the new context and freshly evaluated flags.

## API reference (from `@launchdarkly/react-sdk`)

- **`createClient(clientSideID, context, options?)`**
  Creates a LaunchDarkly client instance (`LDReactClient`). When run on the server, returns a noop client; in the browser, returns a real client. Use this client with `createLDReactProvider`. Call once per "app client" and pass the result to the provider.

- **`initLDReactContext()`**
  Creates a React context and a `useLDClient` hook for the LaunchDarkly client. Returns `{ context, useLDClient }`. Call once per app and pass the `context` to `createLDReactProvider`.

- **`createLDReactProvider(client, context?)`**
  Builds a React Provider component that supplies the client (and initialization state) to the tree. Pass the client from `createClient` and optionally the `context` from `initLDReactContext` (defaults to the built-in `LDReactContext`). Returns a component; wrap your app (or a subtree) with it. **The Provider automatically calls `client.start()` on mount** and re-renders when `client.identify()` is called.

- **`Provider`**
  The component returned by `createLDReactProvider`. Wrap your app with it so descendants can read the client via the context or `useLDClient`.

- **`context`**
  The React context from `initLDReactContext`. Its value is `{ client, context?, initializedState }`. Use `useContext(context)` in components under the Provider to read the client and state.

- **`useLDClient()`**
  Hook returned by `initLDReactContext`. Returns the `LDReactClient` from the nearest Provider. Use in components under the Provider instead of `useContext(context).client` when you only need the client.
