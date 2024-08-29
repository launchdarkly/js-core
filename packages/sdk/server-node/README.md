# LaunchDarkly Server-Side SDK for Node.js

[![NPM][sdk-server-node-npm-badge]][sdk-server-node-npm-link]
[![Actions Status][sdk-server-node-ci-badge]][sdk-server-node-ci]
[![Documentation](https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8)][sdk-server-node-docs-link]

The LaunchDarkly Server-Side SDK for Node.js is designed primarily for use in multi-user systems such as web servers and applications. It follows the server-side LaunchDarkly model for multi-user contexts. It is not intended for use in desktop and embedded systems applications.

For using LaunchDarkly in _client-side_ Node.js applications, refer to our [Client-side Node.js SDK](https://github.com/launchdarkly/node-client-sdk).

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves trillions of feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Supported Node versions

This version of the LaunchDarkly SDK is compatible with Node.js versions 14 and above.

## Getting started

Refer to the [SDK reference guide](https://docs.launchdarkly.com/sdk/server-side/node-js) for instructions on getting started with using the SDK.

## Learn more

Read our [documentation](http://docs.launchdarkly.com) for in-depth instructions on configuring and using LaunchDarkly. You can also head straight to the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/server-side/node-js).

The authoritative description of all properties and methods is in the [TypeScript documentation][sdk-server-node-docs-link].

## Testing

We run integration tests for all our SDKs using a centralized test harness. This approach gives us the ability to test for consistency across SDKs, as well as test networking behavior in a long-running application. These tests cover each method in the SDK, and verify that event sending, flag evaluation, stream reconnection, and other aspects of the SDK all behave correctly.

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md).

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

[sdk-server-node-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-node.yml/badge.svg
[sdk-server-node-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-node.yml
[sdk-server-node-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk.svg?style=flat-square
[sdk-server-node-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk
[sdk-server-node-docs-link]: https://launchdarkly.github.io/js-core/packages/sdk/server-node/docs/
