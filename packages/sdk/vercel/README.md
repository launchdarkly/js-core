# LaunchDarkly Vercel Edge SDK

This library supports using Vercel [Edge Config](https://vercel.com/docs/concepts/edge-network/edge-config) to replace the default in-memory feature store of the [LaunchDarkly Node.js SDK](https://github.com/launchdarkly/vercel-server-sdk).

For more information, see the [SDK features guide](https://docs.launchdarkly.com/sdk/features/storing-data).

## Installation

```shell
npm i @launchdarkly/vercel-server-sdk
```

or yarn:

```shell
yarn add -D @launchdarkly/vercel-server-sdk
```

## Quickstart

Initialize the ldClient with the [Vercel Edge SDK](https://vercel.com/docs/concepts/edge-network/edge-config/edge-config-sdk) and your LaunchDarkly client side sdk key:

```typescript
import init from '@launchdarkly/vercel-server-sdk'
import { createClient } from '@vercel/edge-config'

const edgeClient = createClient(process.env.EDGE_CONFIG)
const ldClient = init(edgeClient, 'YOUR CLIENT-SIDE SDK KEY');
```

<!-- TODO: Get docs ready below -->
To learn more, head straight to the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/server-side/vercel).

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/vercel
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