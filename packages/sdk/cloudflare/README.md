# LaunchDarkly Cloudflare SDK

[![NPM][sdk-server-cloudflare-npm-badge]][sdk-server-cloudflare-npm-link]
[![Actions Status][sdk-server-cloudflare-ci-badge]][sdk-server-cloudflare-ci]
[![Documentation](https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8)](https://launchdarkly.github.io/js-core/packages/sdk/server-cloudflare/docs/)

This library supports using Cloudflare [Workers KV](https://developers.cloudflare.com/workers/learning/how-kv-works) to replace the default in-memory feature store of the [LaunchDarkly Node.js SDK](https://github.com/launchdarkly/cloudflare-server-sdk).

For more information, see the [SDK features guide](https://docs.launchdarkly.com/sdk/features/storing-data).

## Installation

```shell
npm i @launchdarkly/cloudflare-server-sdk
```

or yarn:

```shell
yarn add -D @launchdarkly/cloudflare-server-sdk
```

In `wrangler.toml` in your worker project turn on the Node.js compatibility flag.
This allows the SDK to use `node:events`:

```toml
compatibility_flags = [ "nodejs_compat" ]
```

## Quickstart

Initialize the ldClient with the [Cloudflare KV namespace](https://developers.cloudflare.com/workers/runtime-apis/kv#kv-bindings) and your client side sdk key:

```typescript
import { init } from '@launchdarkly/cloudflare-server-sdk';

const ldClient = init(KV_NAMESPACE, 'YOUR CLIENT-SIDE SDK KEY');
```

To learn more, head straight to the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/server-side/cloudflare).

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/cloudflare

# run tests
yarn test
```

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
