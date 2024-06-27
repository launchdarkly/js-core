> [!IMPORTANT]  
> This is an experimental project to demonstrate the use of LaunchDarkly with Next.js App Router.
>
> This is designed for the App Router. Pages router is not supported.

This solution uses the Node Server SDK and the Javascript SDK. It features:

- Server side rendering with both Server Components and Client Components.
- A client example located in `/app/components/helloLDClient.tsx`
- A React Server Component (RSC) example in `/app/components/helloLDRSC.tsx`
- A universal variation method for calling features on both client and server.

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) using App Router.

## Quickstart

To run this project:

1. Update the .env.local file with your LaunchDarkly SDK Key configurations.

```dotenv
LD_SDK_KEY='<YOUR LD SERVER SDK KEY>'
NEXT_PUBLIC_LD_CLIENT_SIDE_ID='<YOUR LD CLIENT SDK KEY>'
```

Optional - 

1. Either create `dev-test-flag` in your LaunchDarkly environment or replace with your own flags in `helloLDClient.tsx` and/or `helloLDRSC.tsx`.
2. `yarn && yarn dev` or `npm i && npm run dev`

You should see your flag value rendered in the browser.

## API

The code under `ld` exposes server and client apis.

### Server API

- `initNodeSdk` - Initializes the Node SDK on server startup using the [instrumentation hook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)

- `getBootstrap` - Returns a json suitable for bootstrapping the js sdk.

- `useLDClientRsc` - Use this to get an ldClient for Server Components.

### Client API

- `LDProvider` - The react context provider.

- `useLDClient` - Use this to get an ldClient for Client Components.

## How to use this in your own project

Follow these instructions if you want to test this apis in your own project:

1. Enable [instrumentationHook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) in `next.config.mjs`:

```ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { instrumentationHook: true },
};

export default nextConfig;
```

2. Create a new file `instrumentation.ts` at the root of your project. This will initialize the Node Server SDK.

```ts
import { initNodeSdk } from '@/ld/server';

export async function register() {
  await initNodeSdk();
}
```

3. In your root layout component, render the `LDProvider` using your `LDContext` and `bootstrap`:

```tsx
export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // You must supply an LDContext. For example, here getLDContext
  // inspects cookies and defaults to anonymous.
  const context = getLDContext();

  // A bootstrap is required to initialize LDProvider.
  const bootstrap = await getBootstrap(context);

  return (
    <html lang="en">
      <body className={inter.className}>
        <LDProvider context={context} options={{ bootstrap }}>
          {children}
        </LDProvider>
      </body>
    </html>
  );
}
```

4. Server Components must use the `useLDClientRsc` function, and can be async or non-async:

```tsx
// You should use your own getLDContext function.
import { getLDContext } from '@/app/utils';
import { useLDClientRsc } from '@/ld/server';

export default async function HelloRSC() {
  const ldc = await useLDClientRsc(getLDContext());
  const flagValue = ldc.variation('dev-test-flag');

  return (
    <div className="border-2 border-white/20 p-4">
      <p className="text-xl ldgradient">
        {flagValue
          ? "This flag is evaluating True in a React Server Component"
          : "This flag is evaluating False in a React Server Component"}
      </p>
    </div>
  );
}
```

5. Client Components must use the `useLDClient` hook:

```tsx
'use client';

import { useLDClient } from '@/ld/client';

export default function HelloClient() {
  const ldc = useLDClient();
  const flagValue = ldc.variation('dev-test-flag');

  return (
    <div className="border-2 border-white/20  p-4 ">
      <p className="ldgradient text-xl">
        {flagValue
          ? "This flag is evaluating True running Client-Side JavaScript"
          : "This flag is evaluating False running Client-Side JavaScript"}
      </p>
    </div>
  );
}
```

You will see both components are rendered on the server (view source on your browser). However, only Client Components
will respond to live changes.
