# LaunchDarkly AI SDK for Server-Side JavaScript

[![NPM][server-ai-sdk-npm-badge]][server-ai-sdk-npm-link]
[![Actions Status][server-ai-sdk-ci-badge]][server-ai-sdk-ci]
[![Documentation][server-ai-sdk-ghp-badge]][server-ai-sdk-ghp-link]
[![NPM][server-ai-sdk-dm-badge]][server-ai-sdk-npm-link]
[![NPM][server-ai-sdk-dt-badge]][server-ai-sdk-npm-link]

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is a alpha version and should not be considered ready for production use while this message is visible.

# ☝️☝️☝️☝️☝️☝️

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Quick Setup

This assumes that you have already installed the LaunchDarkly Node.js (server-side) SDK, or a compatible edge SDK.

1. Install this package with `npm` or `yarn`:

```shell
npm install @launchdarkly/server-sdk-ai --save
```

2. Create an AI SDK instance:

```typescript
// The ldClient instance should be created based on the instructions in the relevant SDK.
const aiClient = initAi(ldClient);
```

3. Evaluate a model configuration:

```typescript
const config = await aiClient.config(
  aiConfigKey!,
  context,
  { enabled: false },
  { myVariable: 'My User Defined Variable' },
);
```

For an example of how to use the config please refer to the examples folder.

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[server-ai-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai.yml/badge.svg
[server-ai-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai.yml
[server-ai-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai.svg?style=flat-square
[server-ai-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/server-sdk-ai
[server-ai-sdk-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[server-ai-sdk-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/server-ai/docs/
[server-ai-sdk-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/server-sdk-ai.svg?style=flat-square
[server-ai-sdk-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/server-sdk-ai.svg?style=flat-square
