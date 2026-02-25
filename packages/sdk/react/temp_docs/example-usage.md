# Example usage

> **Status:** This doc highlights how to use the LaunchDarkly React SDK with sample code. The SDK is experimental and the API may change.

This doc will examine 3 example uses of the launchdarkly `react-sdk`:

| Example | Description |
|--------|-------------|
| **client-only** | Browser-only React app (e.g. Create React App). Single client created with `createClient` and provided via React context. |
| **server-only** | Next.js App Router with Server Components only. LaunchDarkly Node SDK + `createReactServerClient` for flag evaluation on the server. |
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
  createLDReactProvider,
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
export const { context: LDReactContext } = initLDReactContext();
export const LDReactProvider = createLDReactProvider(client, LDReactContext);
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

Use when you only need flag evaluation in Server Components. No browser client; the Node SDK plus `createReactServerClient` provide a request-scoped client that uses a `contextProvider` for the current user.

### Create the server client

Create the LaunchDarkly Node client and wrap it with `createReactServerClient`, providing a `contextProvider` that returns the LD context for the current request (e.g. from session or headers).

```ts
// /app/page.tsx (conceptually; in the example everything lives in page.tsx)
import { init } from '@launchdarkly/node-server-sdk';
import { createReactServerClient } from '@launchdarkly/react-sdk/server';

const ldClient = init(process.env.LAUNCHDARKLY_SDK_KEY || '');

const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const serverClient = createReactServerClient(ldClient, {
  contextProvider: {
    getContext: () => context,
  },
});
```

### Use in a Server Component

Import the server client only in Server Components (or server-only modules). Call `await serverClient.variation(flagKey, defaultValue)`.

```tsx
// /app/page.tsx
export default async function Home() {
  await ldClient.waitForInitialization({ timeout: 10 });
  const featureFlag = await serverClient.variation(flagKey, false);

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

### Server-only: server client

Create the server client in a **server-only** module. Never import this file from any `'use client'` component.

```ts
// /app/lib/ld-server.ts
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

### Server Component: evaluate flags at request time

Import `ld-server` only in Server Components. Use `await ldServer.variation(key, default)`.

```tsx
// /app/page.tsx
import ldServer from './lib/ld-server';
import ServerSection from './server-section';
import ClientShell from './client-shell';
import ServerContent from './server-content';

const FLAG_KEY = 'sample-feature';

export default async function Home() {
  const flagValue = await ldServer.variation(FLAG_KEY, false);

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

Server components can evaluate flags and render client components as children (client “islands”).

```tsx
// /app/server-section.tsx
import ldServer from './lib/ld-server';
import ClientIsland from './client-island';

export default async function ServerSection() {
  const flagValue = await ldServer.variation(FLAG_KEY, false);

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
import ldServer from './lib/ld-server';

export default async function ServerContent() {
  const flagValue = await ldServer.variation(FLAG_KEY, false);
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
