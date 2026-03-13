# Example usage

> **Status:** This doc highlights how to use the LaunchDarkly React SDK with sample code. The SDK is experimental and the API may change.

This doc will examine 3 example uses of the launchdarkly `react-sdk`:

| Example | Description |
|--------|-------------|
| **client-only** | Browser-only React app (e.g. Create React App). Single client created with `createClient` and provided via React context. |
| **server-only** | Next.js App Router with Server Components only. LaunchDarkly Node SDK + `createLDServerSession` for flag evaluation on the server. |
| **server-and-client** | Next.js App Router with both Server and Client Components. Shared browser client + server client, with clear import boundaries. |

---

## 1. Client-only app

This is the classic react use case.

### Create client and React context

Create the client and provider in a single module (e.g. `src/LDClient.tsx`). Use `'client-only'` or ensure this file is only ever loaded in the browser so the real SDK is bundled.

```tsx
// /src/LDClient.tsx
import {
  createClient,
  LDContext,
  initLDReactContext,
  createLDReactProviderWithClient,
  LDReactClientOptions,
} from '@launchdarkly/react-sdk';
import { LD_CLIENT_SIDE_ID } from './ld-config';

const context: LDContext = {
  kind: 'user',
  name: 'sandy',
  key: 'test-user-key',
};

const options: LDReactClientOptions = {
  streaming: true,
};

const client = createClient(LD_CLIENT_SIDE_ID, context, options);
client.start();
export const { context: LDReactContext } = initLDReactContext();
export const LDReactProvider = createLDReactProviderWithClient(client, LDReactContext);
```

### Wrap the app with the provider

```tsx
// /src/index.tsx
import { LDReactProvider } from './LDClient';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <LDReactProvider>
    <App />
  </LDReactProvider>
);
```

### Use the client in components

Read the client from context and call `variation`, `on`, `off`, etc. Optionally use `useLDClient()` from the same module instead of `useContext(LDReactContext)`.

```tsx
// /src/App.tsx
import { useContext, useEffect, useState } from 'react';
import { LDReactContext } from './LDClient';
import type { LDReactClientContextValue } from '@launchdarkly/react-sdk';

function App() {
  const { client } = useContext<LDReactClientContextValue>(LDReactContext);
  const [flagKey, setFlagKey] = useState('sample-feature');
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    const changeHandler = () => {
      setIsOn(client.variation(flagKey, false));
    };
    client.on(`change:${flagKey}`, changeHandler);
    client.start();
    return () => client.off(`change:${flagKey}`, changeHandler);
  }, [flagKey, client]);

  return (
    <p>
      <strong>{flagKey}</strong> is {isOn ? 'on' : 'off'}
    </p>
  );
}
```

---

## 2. Server-only app (Next.js RSC)

Use when you only need flag evaluation in Server Components. No browser client; the Node SDK plus
`createLDServerSession` provide a request-scoped session bound to a context. `useLDServerSession`
lets any nested Server Component retrieve that session without prop drilling.

### Singleton base client (module-level)

Initialize the Node SDK client once at module level. This instance is shared across all requests.

```ts
// /app/page.tsx (module-level, outside the component)
import { init } from '@launchdarkly/node-server-sdk';
import { createLDServerSession } from '@launchdarkly/react-sdk/server';

// Singleton: initialized once per Node.js process, shared across all requests.
const ldBaseClient = init(process.env.LAUNCHDARKLY_SDK_KEY || '');
```

### Create the session per request (inside the component)

Call `createLDServerSession` inside the Server Component where you have access to the request
(headers, cookies, auth tokens, or query parameters). The session is bound to that request's
context and stored in React's `cache()` for the duration of the render.

```tsx
// /app/page.tsx
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; userName?: string }>;
}) {
  await ldBaseClient.waitForInitialization({ timeout: 10 });

  // Build context from the request. In production this comes from auth/cookies/session;
  // here query parameters are used to make per-user isolation easy to observe.
  const { userId = 'anonymous-user', userName = 'Anonymous' } = await searchParams;
  const context = { kind: 'user' as const, key: userId, name: userName };

  // Creates the session and stores it in React's per-request cache.
  // Nested Server Components can call useLDServerSession() to retrieve it.
  createLDServerSession(ldBaseClient, context);

  return <FeatureSection />;
}
```

### Retrieve the session in nested Server Components

`useLDServerSession()` reads the session from React's cache — no props required. Each request
has its own isolated cache instance, so sessions for different users never interfere.

```tsx
// /app/FeatureSection.tsx
import { useLDServerSession } from '@launchdarkly/react-sdk/server';

const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY || 'sample-feature';

export default async function FeatureSection() {
  // React's cache() ensures this is the session created for the current request.
  const session = useLDServerSession();
  const featureFlag = await session!.boolVariation(flagKey, false);

  return <>{featureFlag ? 'Hello world' : 'Hello world disabled'}</>;
}
```

---

## 3. Server and client app (Next.js RSC + client)

Use when you have both Server Components (for initial render and SEO) and Client Components (for interactivity and live flag updates). You maintain two clients: a **shared** browser client and a **server-only** client, with strict import boundaries.

The reason we are opting for users to maintain their own LDClients is that this is the more complex cases that we've
observed in the field.

### Shared: browser client and context

Create the browser client in a **shared** module that does not import any server-only code. Safe to import from both Server and Client Components; on the server, `createClient` returns a noop client.

```ts
// /app/lib/ld-client.ts
import { createClient } from '@launchdarkly/react-sdk';
import { defaultContext } from './ld-context';

const ldClient = createClient(
  process.env.LD_CLIENT_SIDE_ID || 'test-client-side-id',
  defaultContext,
  { streaming: true }
);

ldClient.start();
export default ldClient;
```

```ts
// /app/lib/ld-context.ts
import { LDContextStrict } from '@launchdarkly/react-sdk';

export const defaultContext: LDContextStrict = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};
```

### Server-only: base client singleton

Export the Node SDK client at module level. Session creation (which binds a context) happens
per-request in the root Server Component.

```ts
// /app/lib/ld-base-client.ts
import { init } from '@launchdarkly/node-server-sdk';

// Singleton: one client per Node.js process, shared across all requests.
const ldBaseClient = init(process.env.LAUNCHDARKLY_SDK_KEY || '');
export default ldBaseClient;
```

### Server Component: create the session and evaluate flags at request time

Import `ld-base-client` only in Server Components. Call `createLDServerSession` inside the
component where you have access to the request context. Nested Server Components can then call
`useLDServerSession()` to retrieve the cached session without prop drilling.

```tsx
// /app/page.tsx
import { createLDServerSession } from '@launchdarkly/react-sdk/server';
import ldBaseClient from './lib/ld-base-client';
import { defaultContext } from './lib/ld-context';
import ServerSection from './server-section';
import ClientShell from './client-shell';
import ServerContent from './server-content';

const FLAG_KEY = 'sample-feature';

export default async function Home() {
  // Create a per-request session. In production derive context from auth/cookies/headers.
  // createLDServerSession also stores the session in React's cache() so nested Server
  // Components can retrieve it via useLDServerSession() — no prop drilling needed.
  const ldServer = createLDServerSession(ldBaseClient, defaultContext);
  const flagValue = await ldServer.boolVariation(FLAG_KEY, false);

  return (
    <main>
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} />
      <ServerSection />
      <ClientShell>
        <ServerContent />
      </ClientShell>
    </main>
  );
}
```

### Nested Server Component

Nested Server Components use `useLDServerSession()` to retrieve the session from React's
per-request cache. They can also render client components as children (client "islands").

```tsx
// /app/server-section.tsx
import { useLDServerSession } from '@launchdarkly/react-sdk/server';
import ClientIsland from './client-island';

export default async function ServerSection() {
  const session = useLDServerSession();
  const flagValue = await session!.boolVariation(FLAG_KEY, false);

  return (
    <>
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} />
      <ClientIsland />
    </>
  );
}
```

### Server Component as children of a Client Component

You can pass a Server Component as `children` to a Client Component. The server content is rendered on the server and slotted in; the client component does not re-render it.

```tsx
// /app/server-content.tsx
import { useLDServerSession } from '@launchdarkly/react-sdk/server';

export default async function ServerContent() {
  const session = useLDServerSession();
  const flagValue = await session!.boolVariation(FLAG_KEY, false);
  return <FlagBadge flagKey={FLAG_KEY} value={flagValue} />;
}
```

### Client Component: live flag updates

Import the **browser** client from the shared module (`ld-client`), not from `ld-server`. Use `ldClient.variation()`, `ldClient.on()`, `ldClient.waitForInitialization()`, etc.

```tsx
// /app/client-island.tsx
'use client';

import { useEffect, useState } from 'react';
import ldClient from './lib/ld-client';

const FLAG_KEY = 'sample-feature';

export default function ClientIsland() {
  const [flagValue, setFlagValue] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => setFlagValue(!!ldClient.variation(FLAG_KEY, false));
    ldClient.waitForInitialization().then(() => {
      setReady(true);
      update();
    });
    ldClient.on(`change:${FLAG_KEY}`, update);
    return () => ldClient.off(`change:${FLAG_KEY}`, update);
  }, []);

  return (
    <>
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} live />
      {!ready && <p>Initializing client SDK…</p>}
    </>
  );
}
```

Same pattern in a client component that also accepts server-rendered children:

```tsx
// /app/client-shell.tsx
'use client';

import ldClient from './lib/ld-client';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [flagValue, setFlagValue] = useState(false);
  // ... same subscription pattern as ClientIsland ...

  return (
    <>
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} live />
      {children}  {/* Server-rendered; not re-evaluated on the client */}
    </>
  );
}
```
