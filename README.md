# LaunchDarkly monorepo for JavaScript SDKs.

This repository contains LaunchDarkly SDK packages which are designed for execution in JavaScript environments.
This includes shared libraries, used by SDKs and other tools, as well as SDKs.

## Packages

| SDK packages                                                                   | npm                                                               | issues                                            | tests                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| [@launchdarkly/akamai-server-base-sdk](packages/sdk/akamai-base/README.md)     | [![NPM][sdk-akamai-base-npm-badge]][sdk-akamai-base-npm-link]     | [Akamai Base][package-sdk-akamai-base-issues]     | [![Actions Status][sdk-akamai-base-ci-badge]][sdk-akamai-base-ci]     |
| [@launchdarkly/akamai-server-edgekv-sdk](packages/sdk/akamai-edgekv/README.md) | [![NPM][sdk-akamai-edgekv-npm-badge]][sdk-akamai-edgekv-npm-link] | [Akamai EdgeKV][package-sdk-akamai-edgekv-issues] | [![Actions Status][sdk-akamai-edgekv-ci-badge]][sdk-akamai-edgekv-ci] |
| [@launchdarkly/cloudflare-server-sdk](packages/sdk/cloudflare/README.md)       | [![NPM][sdk-cloudflare-npm-badge]][sdk-cloudflare-npm-link]       | [Cloudflare][package-sdk-cloudflare-issues]       | [![Actions Status][sdk-cloudflare-ci-badge]][sdk-cloudflare-ci]       |
| [@launchdarkly/fastly-server-sdk](packages/sdk/fastly/README.md)               | [![NPM][sdk-fastly-npm-badge]][sdk-fastly-npm-link]               | [Fastly][package-sdk-fastly-issues]               | [![Actions Status][sdk-fastly-ci-badge]][sdk-fastly-ci]               |
| [@launchdarkly/node-server-sdk](packages/sdk/server-node/README.md)            | [![NPM][sdk-server-node-npm-badge]][sdk-server-node-npm-link]     | [Node.js Server][package-sdk-server-node-issues]  | [![Actions Status][sdk-server-node-ci-badge]][sdk-server-node-ci]     |
| [@launchdarkly/vercel-server-sdk](packages/sdk/vercel/README.md)               | [![NPM][sdk-vercel-npm-badge]][sdk-vercel-npm-link]               | [Vercel][package-sdk-vercel-issues]               | [![Actions Status][sdk-vercel-ci-badge]][sdk-vercel-ci]               |
| [@launchdarkly/react-native-client-sdk](packages/sdk/react-native/README.md)   | [![NPM][sdk-react-native-npm-badge]][sdk-react-native-npm-link]   | [React-Native][package-sdk-react-native-issues]   | [![Actions Status][sdk-react-native-ci-badge]][sdk-react-native-ci]   |
| [@launchdarkly/js-client-sdk](packages/sdk/browser/README.md)                  | [![NPM][sdk-browser-npm-badge]][sdk-browser-npm-link]             | [Browser][package-sdk-browser-issues]             | [![Actions Status][sdk-browser-ci-badge]][sdk-browser-ci]             |
| [@launchdarkly/server-sdk-ai](packages/sdk/server-ai/README.md)                | [![NPM][sdk-server-ai-npm-badge]][sdk-server-ai-npm-link]         | [server-ai][package-sdk-server-ai-issues]         | [![Actions Status][sdk-server-ai-ci-badge]][sdk-server-ai-ci]         |

| Shared packages                                                                      | npm                                                                       | issues                                                      | tests                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [@launchdarkly/js-sdk-common](packages/shared/common/README.md)                      | [![NPM][common-npm-badge]][common-npm-link]                               | [Common][package-shared-common-issues]                      | [![Actions Status][shared-common-ci-badge]][shared-common-ci]                   |
| [@launchdarkly/js-client-sdk-common](packages/shared/sdk-client/README.md)           | [![NPM][js-client-sdk-common-npm-badge]][js-client-sdk-common-npm-link]   | [Common Client][package-shared-sdk-client-issues]           | [![Actions Status][shared-sdk-client-ci-badge]][shared-sdk-client-ci]           |
| [@launchdarkly/js-server-sdk-common](packages/shared/sdk-server/README.md)           | [![NPM][js-server-sdk-common-npm-badge]][js-server-sdk-common-npm-link]   | [Common Server][package-shared-sdk-server-issues]           | [![Actions Status][shared-sdk-server-ci-badge]][shared-sdk-server-ci]           |
| [@launchdarkly/js-server-sdk-common-edge](packages/shared/sdk-server-edge/README.md) | [![NPM][js-server-sdk-common-edge-badge]][js-server-sdk-common-edge-link] | [Common Server Edge][package-shared-sdk-server-edge-issues] | [![Actions Status][shared-sdk-server-edge-ci-badge]][shared-sdk-server-edge-ci] |

| Store Packages                                                                              | npm                                                       | issues                                | tests                                                         |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| [@launchdarkly/node-server-sdk-redis](packages/store/node-server-sdk-redis/README.md)       | [![NPM][node-redis-npm-badge]][node-redis-npm-link]       | [Node Redis][node-redis-issues]       | [![Actions Status][node-redis-ci-badge]][node-redis-ci]       |
| [@launchdarkly/node-server-sdk-dynamodb](packages/store/node-server-sdk-dynamodb/README.md) | [![NPM][node-dynamodb-npm-badge]][node-dynamodb-npm-link] | [Node DynamoDB][node-dynamodb-issues] | [![Actions Status][node-dynamodb-ci-badge]][node-dynamodb-ci] |

| Telemetry Packages                                                                      | npm                                                               | issues                                        | tests                                                                 |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| [@launchdarkly/node-server-sdk-otel](packages/telemetry/node-server-sdk-otel/README.md) | [![NPM][node-otel-npm-badge]][node-otel-npm-link]                 | [Node OTel][node-otel-issues]                 | [![Actions Status][node-otel-ci-badge]][node-otel-ci]                 |
| [@launchdarkly/browser-telemetry](packages/telemetry/browser-telemetry/README.md)       | [![NPM][browser-telemetry-npm-badge]][browser-telemetry-npm-link] | [Browser Telemetry][browser-telemetry-issues] | [![Actions Status][browser-telemetry-ci-badge]][browser-telemetry-ci] |

## Organization

`packages` Top level directory containing package implementations.

`packages/shared` Packages which are primarily intended for consumption by LaunchDarkly and are used in other packages types.

`packages/sdk` SDK packages intended for use by application developers.

`packages/store` Persistent store packages for use with SDKs in this repository.

`packages/telemetry` Packages for adding telemetry support to SDKs.

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves trillions of feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

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
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
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
[//]: # 'shared/sdk-client'
[js-client-sdk-common-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/js-client-sdk-common.svg?style=flat-square
[js-client-sdk-common-npm-link]: https://www.npmjs.com/package/@launchdarkly/js-client-sdk-common
[shared-sdk-client-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-client.yml/badge.svg
[shared-sdk-client-ci]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-client.yml
[package-shared-sdk-client-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+shared%2Fsdk-client%22+
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
[//]: # 'sdk/fastly'
[sdk-fastly-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/fastly.yml/badge.svg
[sdk-fastly-ci]: https://github.com/launchdarkly/js-core/actions/workflows/fastly.yml
[sdk-fastly-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/fastly-server-sdk.svg?style=flat-square
[sdk-fastly-npm-link]: https://www.npmjs.com/package/@launchdarkly/fastly-server-sdk
[package-sdk-fastly-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Ffastly%22+
[sdk-fastly-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-fastly-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/fastly/docs/
[sdk-fastly-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/fastly-server-sdk.svg?style=flat-square
[sdk-fastly-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/fastly-server-sdk.svg?style=flat-square
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
[//]: # 'sdk/react-native'
[sdk-react-native-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml/badge.svg
[sdk-react-native-ci]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml
[sdk-react-native-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[sdk-react-native-npm-link]: https://www.npmjs.com/package/@launchdarkly/react-native-client-sdk
[sdk-react-native-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-react-native-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/react-native/docs/
[sdk-react-native-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[sdk-react-native-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[package-sdk-react-native-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Freact-native%22+
[//]: # 'sdk/akamai-base'
[sdk-akamai-base-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-base.yml/badge.svg
[sdk-akamai-base-ci]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-base.yml
[sdk-akamai-base-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/akamai-server-base-sdk.svg?style=flat-square
[sdk-akamai-base-npm-link]: https://www.npmjs.com/package/@launchdarkly/akamai-server-base-sdk
[sdk-akamai-base-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-akamai-base-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/akamai-base/docs/
[sdk-akamai-base-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/akamai-server-base-sdk.svg?style=flat-square
[sdk-akamai-base-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/akamai-server-base-sdk.svg?style=flat-square
[package-sdk-akamai-base-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fakamai-base%22+
[//]: # 'sdk/akamai-edgekv'
[sdk-akamai-edgekv-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-edgekv.yml/badge.svg
[sdk-akamai-edgekv-ci]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-edgekv.yml
[sdk-akamai-edgekv-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/akamai-server-edgekv-sdk.svg?style=flat-square
[sdk-akamai-edgekv-npm-link]: https://www.npmjs.com/package/@launchdarkly/akamai-server-edgekv-sdk
[sdk-akamai-edgekv-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-akamai-edgekv-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/akamai-edgekv/docs/
[sdk-akamai-edgekv-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/akamai-server-edgekv-sdk.svg?style=flat-square
[sdk-akamai-edgekv-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/akamai-server-edgekv-sdk.svg?style=flat-square
[package-sdk-akamai-edgekv-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fakamai-edgekv%22+
[//]: # 'store/node-server-sdk-redis'
[node-redis-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-redis.yml/badge.svg
[node-redis-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-redis.yml
[node-redis-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk-redis.svg?style=flat-square
[node-redis-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk-redis
[node-redis-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+store%2Fnode-server-sdk-redis%22+
[//]: # 'store/node-server-sdk-dynamodb'
[node-dynamodb-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-dynamodb.yml/badge.svg
[node-dynamodb-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-dynamodb.yml
[node-dynamodb-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk-dynamodb.svg?style=flat-square
[node-dynamodb-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk-dynamodb
[node-dynamodb-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+store%2Fnode-server-sdk-dynamodb%22+
[//]: # 'telemetry/node-server-sdk-otel'
[node-otel-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-otel.yml/badge.svg
[node-otel-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-otel.yml
[node-otel-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk-otel.svg?style=flat-square
[node-otel-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk-otel
[node-otel-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+telemetry%2Fnode-server-sdk-otel%22+
[//]: # 'sdk/browser'
[sdk-browser-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/browser.yml/badge.svg
[sdk-browser-ci]: https://github.com/launchdarkly/js-core/actions/workflows/browser.yml
[sdk-browser-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/js-client-sdk.svg?style=flat-square
[sdk-browser-npm-link]: https://www.npmjs.com/package/@launchdarkly/js-client-sdk
[sdk-browser-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-browser-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/browser/docs/
[sdk-browser-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/js-client-sdk.svg?style=flat-square
[sdk-browser-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/js-client-sdk.svg?style=flat-square
[package-sdk-browser-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fbrowser%22+
[//]: # 'sdk/server-ai'
[sdk-server-ai-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai.yml/badge.svg
[sdk-server-ai-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai.yml
[sdk-server-ai-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai.svg?style=flat-square
[sdk-server-ai-npm-link]: https://www.npmjs.com/package/@launchdarkly/server-sdk-ai
[sdk-server-ai-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-server-ai-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/server-ai/docs/
[sdk-server-ai-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/server-sdk-ai.svg?style=flat-square
[sdk-server-ai-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/server-sdk-ai.svg?style=flat-square
[package-sdk-server-ai-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fserver-ai%22+
[//]: # 'telemetry/browser-telemetry'
[browser-telemetry-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/browser-telemetry.yml/badge.svg
[browser-telemetry-ci]: https://github.com/launchdarkly/js-core/actions/workflows/browser-telemetry.yml
[browser-telemetry-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/browser-telemetry.svg?style=flat-square
[browser-telemetry-npm-link]: https://www.npmjs.com/package/@launchdarkly/browser-telemetry
[browser-telemetry-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+telemetry%2Fbrowser-telemetry%22+
