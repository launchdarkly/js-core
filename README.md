# LaunchDarkly monorepo for JavaScript SDKs.

This repository contains LaunchDarkly SDK packages which are designed for execution in JavaScript environments.
This includes shared libraries, used by SDKs and other tools, as well as SDKs.

## Packages

| SDK packages                                                             | npm                                                           | issues                                           | tests                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| [@launchdarkly/cloudflare-server-sdk](packages/sdk/cloudflare/README.md) | [![NPM][sdk-cloudflare-npm-badge]][sdk-cloudflare-npm-link]   | [Cloudflare][package-sdk-cloudflare-issues]      | [![Actions Status][sdk-cloudflare-ci-badge]][sdk-cloudflare-ci]   |
| [@launchdarkly/node-server-sdk](packages/sdk/server-node/README.md)      | [![NPM][sdk-server-node-npm-badge]][sdk-server-node-npm-link] | [Node.js Server][package-sdk-server-node-issues] | [![Actions Status][sdk-server-node-ci-badge]][sdk-server-node-ci] |
| [@launchdarkly/vercel-server-sdk](packages/sdk/vercel/README.md)         | [![NPM][sdk-vercel-npm-badge]][sdk-vercel-npm-link]           | [Vercel][package-sdk-vercel-issues]              | [![Actions Status][sdk-vercel-ci-badge]][sdk-vercel-ci]           |
| [@launchdarkly/akamai-server-sdk](packages/sdk/akamai/README.md)         | [![NPM][sdk-akamai-npm-badge]][sdk-akamai-npm-link]           | [Akamai][package-sdk-akamai-issues]              | [![Actions Status][sdk-akamai-ci-badge]][sdk-akamai-ci]           |

| Shared packages                                                                      | npm                                                                       | issues                                                      | tests                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [@launchdarkly/js-sdk-common](packages/shared/common/README.md)                      | [![NPM][common-npm-badge]][common-npm-link]                               | [Common][package-shared-common-issues]                      | [![Actions Status][shared-common-ci-badge]][shared-common-ci]                   |
| [@launchdarkly/js-server-sdk-common](packages/shared/sdk-server/README.md)           | [![NPM][js-server-sdk-common-npm-badge]][js-server-sdk-common-npm-link]   | [Common Server][package-shared-sdk-server-issues]           | [![Actions Status][shared-sdk-server-ci-badge]][shared-sdk-server-ci]           |
| [@launchdarkly/js-server-sdk-common-edge](packages/shared/sdk-server-edge/README.md) | [![NPM][js-server-sdk-common-edge-badge]][js-server-sdk-common-edge-link] | [Common Server Edge][package-shared-sdk-server-edge-issues] | [![Actions Status][shared-sdk-server-edge-ci-badge]][shared-sdk-server-edge-ci] |

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

[//]: # 'shared/common'
[common-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/js-sdk-common.svg?style=flat-square
[common-npm-link]: https://www.npmjs.com/package/@launchdarkly/js-sdk-common
[shared-common-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/common.yml/badge.svg
[shared-common-ci]: https://github.com/launchdarkly/js-core/actions/workflows/common.yml
[package-shared-common-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+shared%2Fcommon%22+
[//]: # 'shared/sdk-server'
[js-server-sdk-common-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/js-server-sdk-common.svg?style=flat-square
[js-server-sdk-common-npm-link]: https://www.npmjs.com/package/@launchdarkly/js-server-sdk-common
[shared-sdk-server-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server.yml/badge.svg
[shared-sdk-server-ci]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server.yml
[package-shared-sdk-server-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+shared%2Fsdk-server%22+
[//]: # 'shared/sdk-server-edge'
[js-server-sdk-common-edge-badge]: https://img.shields.io/npm/v/@launchdarkly/js-server-sdk-common-edge.svg?style=flat-square
[js-server-sdk-common-edge-link]: https://www.npmjs.com/package/@launchdarkly/js-server-sdk-common-edge
[shared-sdk-server-edge-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server-edge.yml/badge.svg
[shared-sdk-server-edge-ci]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server-edge.yml
[package-shared-sdk-server-edge-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+shared%2Fsdk-server-edge%22+
[//]: # 'sdk/cloudflare'
[sdk-cloudflare-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/cloudflare.yml/badge.svg
[sdk-cloudflare-ci]: https://github.com/launchdarkly/js-core/actions/workflows/cloudflare.yml
[sdk-cloudflare-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/cloudflare-server-sdk.svg?style=flat-square
[sdk-cloudflare-npm-link]: https://www.npmjs.com/package/@launchdarkly/cloudflare-server-sdk
[sdk-cloudflare-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-cloudflare-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/cloudflare/docs/
[sdk-cloudflare-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/cloudflare-server-sdk.svg?style=flat-square
[sdk-cloudflare-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/cloudflare-server-sdk.svg?style=flat-square
[package-sdk-cloudflare-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fcloudflare%22+
[//]: # 'sdk/server-node'
[sdk-server-node-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk.svg?style=flat-square
[sdk-server-node-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk
[sdk-server-node-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-node.yml/badge.svg
[sdk-server-node-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-node.yml
[package-sdk-server-node-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fserver-node%22+
[//]: # 'sdk/vercel'
[sdk-vercel-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/vercel.yml/badge.svg
[sdk-vercel-ci]: https://github.com/launchdarkly/js-core/actions/workflows/vercel.yml
[sdk-vercel-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/vercel-server-sdk.svg?style=flat-square
[sdk-vercel-npm-link]: https://www.npmjs.com/package/@launchdarkly/vercel-server-sdk
[sdk-vercel-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-vercel-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/vercel/docs/
[sdk-vercel-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/vercel-server-sdk.svg?style=flat-square
[sdk-vercel-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/vercel-server-sdk.svg?style=flat-square
[package-sdk-vercel-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fvercel%22+
[//]: # 'sdk/vercel'
[sdk-akamai-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/akamai.yml/badge.svg
[sdk-akamai-ci]: https://github.com/launchdarkly/js-core/actions/workflows/akamai.yml
[sdk-akamai-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/akamai-server-sdk.svg?style=flat-square
[sdk-akamai-npm-link]: https://www.npmjs.com/package/@launchdarkly/akamai-server-sdk
[sdk-akamai-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-akamai-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/akamai/docs/
[sdk-akamai-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/akamai-server-sdk.svg?style=flat-square
[sdk-akamai-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/akamai-server-sdk.svg?style=flat-square
[package-sdk-akamai-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fakamai%22+
