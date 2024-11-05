# LaunchDarkly AI SDK for Node.js

This package provides the LaunchDarkly AI SDK for Node.js.

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Quick Setup

This assumes that you have already installed the LaunchDarkly Node.js SDK, or a compatible edge
SDK.

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
```
  const config = await aiClient.modelConfig(
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

[node-otel-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-otel.yml/badge.svg
[node-otel-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-otel.yml
[node-otel-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk-otel.svg?style=flat-square
[node-otel-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk-otel
