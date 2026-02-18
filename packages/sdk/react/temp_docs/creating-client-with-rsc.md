# Creating a LaunchDarkly client with React Server Components

> **Status:** The LaunchDarkly React SDK and RSC support are experimental. The APIs described in this document are not fully implemented and may change. This doc reflects intended design and usage.

## Overview

To use LaunchDarkly in an app that uses React Server Components (RSC), you create an **isomorphic client** via `createClient` from `@launchdarkly/react-sdk`. That client works in both Client Components and, when federated with a server client, in Server Components.

The isomorphic client supports two modes:

- **Client-only (default):** If you never call `useServerClient`, the client evaluates flags only on the client. This is the default and is sufficient for apps that do not need server-side flag evaluation.
- **Client + server:** After you call `useServerClient(serverClient)` on the isomorphic client, the same client can be used in React Server Components; server-side evaluation will use the server client you provided.

## Why the server client is opt-in

The RSC-capable server client is kept separate, and developers must explicitly call `useServerClient` in their client creation flow, for two reasons:

1. **Flexibility:** We want to remain flexible about which server SDK can be used to drive RSC (e.g. Node vs edge, or future runtimes). The React SDK does not bundle or mandate a specific server SDK; it only expects a client that conforms to the `LDReactServerClient` interface. You can use the LaunchDarkly Node SDK, an edge SDK, or another implementation that matches that interface.

2. **Ownership:** Lifecycle and management of the server SDK—creation, configuration, and disposal—are left to the developer. The React SDK only consumes a server client you provide. This keeps the React SDK focused on the client/isomorphic layer and keeps server-SDK choices in your application’s hands.

## Entry points and types

- **Main entry:** `createClient(clientSideID, context, options?)` from `@launchdarkly/react-sdk`. Returns an `LDIsomorphicClient`. Options are `LDIsomorphicOptions` (extends client options, e.g. `useCamelCaseFlagKeys`).

- **Server entry:** `createReactServerClient(client, options)` from `@launchdarkly/react-sdk/server`. Accepts a standard LaunchDarkly server `LDClient` and `LDReactServerOptions` (which requires `contextProvider: LDContextProvider`). Returns an `LDReactServerClient`.

## Intended flow (step-by-step)

1. **Create the isomorphic client.** Call `createClient(clientSideID, initialContext, options)` to get an `LDIsomorphicClient`. This client can be used in Client Components for variations, `allFlags`, `identify`, and other client-side APIs.

2. **Set up the server.** In your server environment, create a standard LaunchDarkly server client (using your SDK key and any server-SDK options). Implement `LDContextProvider` so that `getContext()` returns the LaunchDarkly context for the current request (e.g. from request, session, or cookies). Then call `createReactServerClient(serverClient, { contextProvider })` to get an `LDReactServerClient`.

3. **Federate for RSC.** Call `isomorphicClient.useServerClient(reactServerClient)` (e.g. in a root layout or provider) so the same isomorphic client can be used in React Server Components. Without this step, only client-side flag evaluation is available.

4. **Use the client.** Use the same isomorphic client in both Client Components (client-side evaluation) and Server Components (server-side evaluation via the federated server client). On the server, context is supplied per request by your `LDContextProvider`.

## Context provider

`LDContextProvider` is the bridge between your framework (e.g. Next.js App Router) and LaunchDarkly. It has a required `getContext()` that returns the `LDContext` for the current request. Optionally, `setContext(context)` can be used to update the context associated with the request or session. Implementation is application-specific: you might read the user from session, headers, or cookies and build an `LDContext` from that.

## Code sketch (intended usage)

The following is conceptual; implementations are not yet complete.

```ts
// 1. Create the isomorphic client (e.g. in a shared module or root layout)
import { createClient } from '@launchdarkly/react-sdk';

const client = createClient(clientSideID, initialContext, options);
// client is an LDIsomorphicClient; use in Client Components as-is.
```

```ts
// 2. Server: create your server LDClient and context provider, then create the React server client
import { createReactServerClient } from '@launchdarkly/react-sdk/server';
// import your server SDK's createClient / LDClient as needed

const contextProvider = {
  getContext: () => { /* return LDContext for this request, e.g. from session */ },
};
const reactServerClient = createReactServerClient(serverClient, { contextProvider });
```

```tsx
// 3. Federate the isomorphic client with the server client (e.g. in root layout or provider)
client.useServerClient(reactServerClient);
// Now the same client can be used in Server Components.
```

> [!caution]
> Everything below is wildly hypothetical
```tsx
// 4a. Use in a Client Component
'use client';
function ClientFeature() {
  const enabled = client.boolVariation('my-flag', false);
  return enabled ? <NewUI /> : <OldUI />;
}
```

```tsx
// 4b. Use in a Server Component (when useServerClient was called)
async function ServerFeature() {
  const enabled = await client.boolVariation('my-flag', false);
  return enabled ? <NewUI /> : <OldUI />;
}
```
