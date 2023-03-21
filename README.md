# LaunchDarkly monorepo for JavaScript SDKs.

This repository contains LaunchDarkly SDK packages which are designed for execution in JavaScript environments.
This includes shared libraries, used by SDKs and other tools, as well as SDKs.

potato

## Packages

| SDK Packages                                                 | npm                          | issues                         | tests                                                                   |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| [@launchdarkly/node-server-sdk](packages/sdk/server-node/README.md) | [![NPM][sdk-server-node-npm-badge]][sdk-server-node-npm-link] | [Node.js Server][package-sdk-server-node-issues] | [![Actions Status][sdk-server-node-ci-badge]][sdk-server-node-ci-badge] |

| Shared Packages                                                            | npm                          | issues                         | tests                                                                 |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| [@launchdarkly/js-sdk-common](packages/shared/common/README.md)            | [![NPM][common-npm-badge]][common-npm-link] | [Common][package-shared-common-issues]        | [![Actions Status][shared-common-ci-badge]][shared-common-ci]         |
| [@launchdarkly/js-server-sdk-common](packages/shared/sdk-server/README.md) | [![NPM][js-server-sdk-common-badge]][js-server-sdk-common-link]| [Common Server][package-shared-sdk-server-issues] | [![Actions Status][shared-sdk-server-ci-badge]][shared-sdk-server-ci] |

## Organization

`packages` Top level directory containing package implementations.

`packages/shared` Packages which are primarily intended for consumption by LaunchDarkly and are used in other packages types.

`packages/sdk` SDK packages intended for use by application developers.

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Testing

We run integration tests for all our SDKs using a centralized test harness. This approach gives us the ability to test for consistency across SDKs, as well as test networking behavior in a long-running application. These tests cover each method in the SDK, and verify that event sending, flag evaluation, stream reconnection, and other aspects of the SDK all behave correctly.

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[shared-common-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/common.yml/badge.svg
[shared-common-ci]: https://github.com/launchdarkly/js-core/actions/workflows/common.yml
[shared-sdk-server-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server.yml/badge.svg
[shared-sdk-server-ci]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server.yml
[sdk-server-node-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-node.yml/badge.svg
[sdk-server-node-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-node.yml


[package-shared-common-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+shared%2Fcommon%22+
[package-shared-sdk-server-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+shared%2Fsdk-server%22+
[package-sdk-server-node-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fserver-node%22+

[common-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/js-sdk-common.svg?style=flat-square
[common-npm-link]: https://www.npmjs.com/package/@launchdarkly/js-sdk-common

[js-server-sdk-common-badge]: https://img.shields.io/npm/v/@launchdarkly/js-server-sdk-common.svg?style=flat-square
[js-server-sdk-common-link]: https://www.npmjs.com/package/@launchdarkly/js-server-sdk-common

[sdk-server-node-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk.svg?style=flat-square
[sdk-server-node-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk
