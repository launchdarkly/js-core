# Creating a LaunchDarkly client with React Server Components

> **Status:** The LaunchDarkly React SDK and RSC support are experimental. The APIs described in this document may change.

## Overview

To use LaunchDarkly in an app that uses React Server Components (RSC), the **current recommended approach** is:

1. **Create the browser client** with `createClient` from `@launchdarkly/react-sdk` in a **shared** module (e.g. `ld-client.ts`) that does not import any server-only code. That same module can run on server and client; on the server, `createClient` returns a noop client, so the browser SDK is never loaded in server bundles.

2. **Create the server client** in **server-only** code (e.g. `ld-server.ts`) with your LaunchDarkly server SDK and `createReactServerClient` from `@launchdarkly/react-sdk/server`, providing a `contextProvider` so the server client has the LD context for each request.

3. **Use the right client per boundary:** In Server Components, import the server client from `ld-server` and use `await ldServer.variation(key, default)`. In Client Components, import the browser client from `ld-client` and use `ldClient.variation()`, `ldClient.on()`, `ldClient.waitForInitialization()`, etc.

## Entry points and types

- **Main entry (`@launchdarkly/react-sdk`):** `createClient(clientSideID, context, options?)` returns an `LDReactClient`. On the server it is a noop; in the browser it is the real client. Options are `LDReactClientOptions` (e.g. streaming, bootstrap). The main entry uses `'client-only'` so it is not bundled for the server.

- **Server entry (`@launchdarkly/react-sdk/server`):** `createReactServerClient(serverClient, options)` accepts a standard LaunchDarkly server `LDClient` (e.g. from the Node SDK) and `LDReactServerOptions` (which requires `contextProvider: LDContextProvider`). Returns an `LDReactServerClient`. The server entry uses `'server-only'`. When run in the browser (e.g. in code that is shared), `createReactServerClient` returns a no-op client that returns default values.

## Intended flow (step-by-step)

1. **Create the browser client in a shared module.** In a file that is safe to import from both Server and Client Components (e.g. `app/lib/ld-client.ts`), call `createClient(clientSideID, context, options)` from `@launchdarkly/react-sdk`. Export the client (e.g. default export `ldClient`). Do not import `ld-server` or `@launchdarkly/react-sdk/server` here. On the server this client is a noop; in the browser it is the real client. You can call `ldClient.start()` in this module so the client starts when used in the browser.

2. **Create the server client in server-only code.** In a file that is only ever imported by Server Components or other server-only modules (e.g. `app/lib/ld-server.ts`), create your LaunchDarkly server client (e.g. with `init()` from `@launchdarkly/node-server-sdk`). Implement a `contextProvider` whose `getContext()` returns the LaunchDarkly context for the current request (e.g. from session, headers, or cookies). Call `createReactServerClient(serverClient, { contextProvider })` from `@launchdarkly/react-sdk/server` and export the result (e.g. default export `serverClient` or `ldServer`).

3. **Use the client.** In **Server Components**, import the server client from the server-only module (e.g. `ldServer` from `./lib/ld-server`) and call `await ldServer.variation(flagKey, defaultValue)`. In **Client Components**, import the browser client from the shared module (e.g. `ldClient` from `./lib/ld-client`) and use `ldClient.variation()`, `ldClient.on()`, `ldClient.waitForInitialization()`, etc., as needed.

## Context provider

`LDContextProvider` is the bridge between your framework (e.g. Next.js App Router) and LaunchDarkly on the server. It has a required `getContext()` that returns the `LDContext` for the current request. Optionally, `setContext(context)` can be used to update the context. Implementation is application-specific: you might read the user from session, headers, or cookies and build an `LDContext` from that.

## Code examples

The following aligns with the server-and-client example in the repo.

**Shared module: browser client (`app/lib/ld-client.ts`)**

Do not import server-only modules here. Safe to import from both Server and Client Components.

```ts
import { createClient } from '@launchdarkly/react-sdk';
import { defaultContext } from './ld-context';

const ldClient = createClient(
  process.env.LD_CLIENT_SIDE_ID || 'test-client-side-id',
  defaultContext,
  {
    streaming: true,
  },
);

ldClient.start();

export default ldClient;
```

**Server-only: server client (`app/lib/ld-server.ts`)**

This module must only be imported by Server Components or other server-only code. Do not import it from any `'use client'` component.

```ts
import { init } from '@launchdarkly/node-server-sdk';
import { createReactServerClient } from '@launchdarkly/react-sdk/server';
import { defaultContext } from './ld-context';

const ldClient = init(process.env.LAUNCHDARKLY_SDK_KEY || '');

const serverClient = createReactServerClient(ldClient, {
  contextProvider: {
    getContext: () => defaultContext,
  },
});

export default serverClient;
```

**Server Component (e.g. `app/page.tsx`)**

```tsx
import ldServer from './lib/ld-server';
import ClientRendered from './client-rendered';

const flagKey = 'sample-feature';

export default async function Home() {
  const serverFlagValue = await ldServer.variation(flagKey, false);
  return (
    <>
      <p>Server: <strong>{flagKey}</strong> is {serverFlagValue ? 'on' : 'off'}</p>
      <ClientRendered />
    </>
  );
}
```

**Client Component (e.g. `app/client-rendered.tsx`)**

Import `ldClient` from the shared module so server-only code is not pulled into the client bundle.

```tsx
'use client';

import ldClient from './lib/ld-client';
import { useEffect, useState } from 'react';

const flagKey = 'sample-feature';

export default function ClientRendered() {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    const updateFlag = () => {
      const value = ldClient.variation(flagKey, false);
      setIsOn(!!value);
    };
    ldClient.on(`change:${flagKey}`, updateFlag);
    ldClient.waitForInitialization().then(() => updateFlag());
    return () => ldClient.off(`change:${flagKey}`, updateFlag);
  }, []);

  return (
    <p>Client: <strong>{flagKey}</strong> is {isOn ? 'on' : 'off'}</p>
  );
}
```

## Import boundaries

- **Shared:** Import from `app/lib/ld-client` in Client Components. The `ld-client` module must not import any server-only code.
- **Server only:** Import from `app/lib/ld-server` only in Server Components or server-only modules. Do not import `ld-server` in any `'use client'` file.

## Entry points and tree-shaking

The main entry (`@launchdarkly/react-sdk`) is built with `'client-only'`, so it is not bundled for the server. The server entry (`@launchdarkly/react-sdk/server`) is built with `'server-only'`. If you only use the main entry in client bundles, server code is not included. When `createReactServerClient` is called in the browser (e.g. in shared code), it returns a no-op client, so it is safe to use from modules that might load on both sides—but for clarity, prefer importing `ld-server` only in server code so Client Components never pull in the server module.
