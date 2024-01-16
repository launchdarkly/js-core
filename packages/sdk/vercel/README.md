# LaunchDarkly Vercel Edge SDK

[![NPM][sdk-vercel-npm-badge]][sdk-vercel-npm-link]
[![Actions Status][sdk-vercel-ci-badge]][sdk-vercel-ci]
[![Documentation][sdk-vercel-ghp-badge]][sdk-vercel-ghp-link]
[![NPM][sdk-vercel-dm-badge]][sdk-vercel-npm-link]
[![NPM][sdk-vercel-dt-badge]][sdk-vercel-npm-link]

This library supports using Vercel [Edge Config](https://vercel.com/docs/concepts/edge-network/edge-config) to replace the default in-memory feature store of the [LaunchDarkly Node.js SDK](https://github.com/launchdarkly/node-server-sdk).

## The LaunchDarkly Vercel integration is required

This SDK requires [LaunchDarkly's Vercel integration](https://docs.launchdarkly.com/integrations/vercel?q=verc) to push feature flag data into a Vercel Edge Config. The Vercel integration is available to customers on an Enterprise plan. To learn more, [read about our pricing](https://launchdarkly.com/pricing/). To upgrade your plan, [contact Sales](https://launchdarkly.com/contact-sales/).

For more information, see the [Vercel SDK reference](https://docs.launchdarkly.com/sdk/edge/vercel).

## Install

```shell
npm i @launchdarkly/vercel-server-sdk
```

or yarn:

```shell
yarn add -D @launchdarkly/vercel-server-sdk
```

## Quick start

Initialize the ldClient with the [Vercel Edge SDK](https://vercel.com/docs/concepts/edge-network/edge-config/edge-config-sdk) and your LaunchDarkly [client-side ID](https://docs.launchdarkly.com/sdk/concepts/client-side-server-side#client-side-id):

```typescript
import { createClient } from '@vercel/edge-config';

import { init } from '@launchdarkly/vercel-server-sdk';

const edgeClient = createClient(process.env.EDGE_CONFIG);
const ldClient = init('YOUR CLIENT-SIDE ID', edgeClient);

await ldClient.waitForInitialization();
const ldContext = {
  kind: 'org',
  key: 'my-org-key',
  someAttribute: 'my-attribute-value',
};
const flagValue = await ldClient.variation('my-flag', ldContext, true);
```

To learn more, see the [examples](examples/README.md) in this repository or head straight to the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/server-side/vercel).


> **⚠️ experimental**
> 
> This SDK has experimental support for sending analytic events to LaunchDarkly. It can be enabled by setting `sendEvents` to `true` in the SDK options. 
>```typescript
>    const client = initLD(sdkKey, env.LD_KV, {sendEvents: true});
>```

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/vercel
# run tests
yarn test
```

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md). 

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[sdk-vercel-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/vercel.yml/badge.svg
[sdk-vercel-ci]: https://github.com/launchdarkly/js-core/actions/workflows/vercel.yml
[sdk-vercel-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/vercel-server-sdk.svg?style=flat-square
[sdk-vercel-npm-link]: https://www.npmjs.com/package/@launchdarkly/vercel-server-sdk
[sdk-vercel-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-vercel-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/vercel/docs/
[sdk-vercel-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/vercel-server-sdk.svg?style=flat-square
[sdk-vercel-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/vercel-server-sdk.svg?style=flat-square
