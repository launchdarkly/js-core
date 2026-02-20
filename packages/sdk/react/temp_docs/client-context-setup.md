# Setting up the LaunchDarkly client context (client-only)

> **Status:** This doc describes the recommended pattern for the React SDK client. The SDK is experimental and the API may change.

## Overview

The React SDK does not use a singleton. Your app creates the LaunchDarkly client and React context in one place by calling `createClientContext` from `@launchdarkly/react-sdk/client`. You then re-export `Provider` and `Context` from that module so the rest of your app imports from a single path (e.g. `@/lib/launchdarkly` or `./LDClient`).

## Why one file?

- **No singleton:** The SDK does not own a single global client. You can have multiple clients or different configs per environment.
- **You own config:** Client-side ID, initial context, and options are app-specific (often from env or config). That setup lives in your codebase.
- **Single import path:** Once the context is created and re-exported, every component imports `Provider`, `Context`, or (when available) `useLDClient` from the same module.
    > NOTE: We will also put hooks into this scoped export

## Setup

### 1. Create a single module that creates and re-exports the context

Create a file that will be the single place where `createClientContext` is called. For example `src/LDClient.tsx`, `src/lib/launchdarkly.ts`, or `src/launchdarkly.ts`.

```tsx
import { LDContext } from '@launchdarkly/react-sdk';
import { createClientContext } from '@launchdarkly/react-sdk/client';

// Your app's config: env, constants, or dynamic values
const clientSideID = process.env.REACT_APP_LD_CLIENT_SIDE_ID ?? '';
const context: LDContext = {
  kind: 'user',
  key: 'user-key',
  name: 'User Name',
};

export const { Provider, Context } = createClientContext(clientSideID, context);
```

Optional: use a path alias (e.g. `@/lib/launchdarkly`) in your bundler/tsconfig so the path is short and stable.

### 2. Wrap the app with `Provider`

At the root of your app (e.g. in `main.tsx`, `App.tsx`, or layout), wrap the tree with the exported `Provider`:

```tsx
import { Provider } from './LDClient';  // or '@/lib/launchdarkly'

root.render(
  <Provider>
    <App />
  </Provider>
);
```

### 3. Use the client in components

Import `Context` from the same module and use React’s `useContext` to read the client and related state:

```tsx
import { useContext } from 'react';
import { Context } from './LDClient';  // or '@/lib/launchdarkly'

function MyComponent() {
  const { client } = useContext(Context);
  const isOn = client.boolVariation('my-flag', false);
  return <div>Flag is {isOn ? 'on' : 'off'}</div>;
}
```

## API reference (from `@launchdarkly/react-sdk/client`)

- **`createClientContext(clientSideID, context, options?)`**  
  Creates the LaunchDarkly client and a React context/provider for it. Returns `{ Provider, Context }`. Call once per “app client” and re-export from your module.

- **`Provider`**  
  React component that provides the client and context value to the tree. Wrap your app (or a subtree) with it.

- **`Context`**  
  React context whose value is `{ client, context?, intializedState }`. Use `useContext(Context)` in components under `Provider`.

- **`createClient(clientSideID, context, options?)`**  
  Creates a client instance only (no React context). Use if you need a raw client without the Provider/Context pattern.

- **`createContextFromClient(client)`**  
  Builds `{ Provider, Context }` from an existing client instance. Use when you create the client yourself and only need the React binding.
