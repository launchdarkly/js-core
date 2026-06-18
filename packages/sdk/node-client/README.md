# LaunchDarkly Node.js Client-Side SDK

[![NPM][node-client-npm-badge]][node-client-npm-link]
[![Actions Status][node-client-ci-badge]][node-client-ci]
[![Documentation][node-client-ghp-badge]][node-client-ghp-link]
[![NPM][node-client-dm-badge]][node-client-npm-link]
[![NPM][node-client-dt-badge]][node-client-npm-link]

> [!CAUTION]
> This SDK is in pre-release and not subject to backwards compatibility
> guarantees. The API may change based on feedback.
>
> Pin to a specific minor version and review the [changelog](CHANGELOG.md) before upgrading.

## Getting started

Refer to the [SDK documentation](https://launchdarkly.com/docs/sdk/client-side/node-js#getting-started) for instructions on getting started with using the SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the 'gold' plan get access to more features than users in the 'silver' plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates


[node-client-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-client.yml/badge.svg
[node-client-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-client.yml
[node-client-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-client-sdk.svg?style=flat-square
[node-client-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-client-sdk
[node-client-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[node-client-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/node-client/docs/
[node-client-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/node-client-sdk.svg?style=flat-square
[node-client-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/node-client-sdk.svg?style=flat-square
