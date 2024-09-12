# LaunchDarkly Netlify SDK

[![NPM][sdk-netlify-npm-badge]][sdk-netlify-npm-link]
[![Actions Status][sdk-netlify-ci-badge]][sdk-netlify-ci]
[![Documentation][sdk-netlify-ghp-badge]][sdk-netlify-ghp-link]
[![NPM][sdk-netlify-dm-badge]][sdk-netlify-npm-link]
[![NPM][sdk-netlify-dt-badge]][sdk-netlify-npm-link]

The LaunchDarkly Netlify SDK is designed for use with Netlify. It follows the server-side LaunchDarkly model for multi-user contexts.

For more information, see the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/server-side/netlify).

## Install

```shell
# npm
npm i @launchdarkly/netlify-server-sdk

# yarn
yarn add @launchdarkly/netlify-server-sdk
```

## Quickstart

?????TODO?????

Initialize the ldClient with your client side sdk key and the [Cloudflare KV namespace](https://developers.cloudflare.com/workers/runtime-apis/kv#kv-bindings):

```typescript
import { init as initLD } from '@launchdarkly/cloudflare-server-sdk';

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const clientSideID = 'test-client-side-id';
    const flagKey = 'testFlag1';
    const context = { kind: 'user', key: 'test-user-key-1' };

    // init the ldClient, wait and finally evaluate
    const client = initLD(clientSideID, env.LD_KV);
    await client.waitForInitialization();
    const flagValue = await client.variation(flagKey, context, false);

    return new Response(`${flagKey}: ${flagValue}`);
  },
};
```

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/netlify

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
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[sdk-netlify-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/netlify.yml/badge.svg
[sdk-netlify-ci]: https://github.com/launchdarkly/js-core/actions/workflows/netlify.yml
[sdk-netlify-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/netlify-server-sdk.svg?style=flat-square
[sdk-netlify-npm-link]: https://www.npmjs.com/package/@launchdarkly/netlify-server-sdk
[sdk-netlify-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-netlify-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/netlify/docs/
[sdk-netlify-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/netlify-server-sdk.svg?style=flat-square
[sdk-netlify-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/netlify-server-sdk.svg?style=flat-square
