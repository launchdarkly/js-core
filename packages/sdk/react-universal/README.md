# LaunchDarkly React Universal SDK

[![NPM][react-universal-sdk-npm-badge]][react-universal-sdk-npm-link]
[![Actions Status][react-universal-sdk-ci-badge]][react-universal-sdk-ci]
[![Documentation][react-universal-sdk-ghp-badge]][react-universal-sdk-ghp-link]
[![NPM][react-universal-sdk-dm-badge]][react-universal-sdk-npm-link]
[![NPM][react-universal-sdk-dt-badge]][react-universal-sdk-npm-link]

> [!CAUTION]
> This library is a beta version and should not be considered ready for production use while this message is visible.

## Features

- Supports both React Server Components and Client Components
- Idiomatic server side rendering
- Bootstrapping out of the box

## Install

```shell
# npm
npm i @launchdarkly/react-universal-sdk

# yarn
yarn add -D @launchdarkly/react-universal-sdk
```

## Server API

- `initNodeSdk` - Initializes the Node SDK on startup.

- `getBootstrap` - Produces suitable bootstrap the js sdk.

- `useLDClientRsc` - Gets a suitable ld client for Server Components.

## Client API

- `LDProvider` - The react context provider.

- `useLDClient` - Gets a suitable ld client for Client Components.

## Usage

1. Enable [instrumentationHook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) in `next.config.mjs`:

```ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { instrumentationHook: true },
};

export default nextConfig;
```

2. In `instrumentation.ts`, initialize the Node Server SDK:

```ts
import { initNodeSdk } from '@launchdarkly/react-universal-sdk/server';

export async function register() {
  await initNodeSdk();
}
```

3. In the root layout, render the `LDProvider` using your `LDContext` and `bootstrap`:

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

4. Server Components must use the async `useLDClientRsc` function:

```tsx
// You should use your own getLDContext function.
import { getLDContext } from '@/app/utils';

import { useLDClientRsc } from '@launchdarkly/react-universal-sdk/server';

export default async function Page() {
  const ldc = await useLDClientRsc(getLDContext());
  const flagValue = ldc.variation('my-boolean-flag-1');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      Server Component: {flagValue.toString()}
    </main>
  );
}
```

5. Client Components must use the `useLDClient` hook:

```tsx
'use client';

import { useLDClient } from '@launchdarkly/react-universal-sdk/client';

export default function LDButton() {
  const ldc = useLDClient();
  const flagValue = ldc.variation('my-boolean-flag-1');

  return <p>Client Component: {flagValue.toString()}</p>;
}
```

You will see both Server and Client Components are rendered on the server (view source on your browser). However, only Client Components will respond to live changes because Server Components are excluded from the client bundle.

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md).

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[react-universal-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/react-universal-sdk.yml/badge.svg
[react-universal-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/react-universal-sdk.yml
[react-universal-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/react-universal-sdk.svg?style=flat-square
[react-universal-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/react-universal-sdk
[react-universal-sdk-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[react-universal-sdk-ghp-link]: https://launchdarkly.github.io/js-core/packages/tooling/react-universal-sdk/docs/
[react-universal-sdk-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/react-universal-sdk.svg?style=flat-square
[react-universal-sdk-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/react-universal-sdk.svg?style=flat-square
