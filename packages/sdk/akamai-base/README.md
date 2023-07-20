# LaunchDarkly Akamai Base SDK

[![NPM][sdk-akamai-base-npm-badge]][sdk-akamai-base-npm-link]
[![Actions Status][sdk-akamai-base-ci-badge]][sdk-akamai-base-ci]
[![Documentation][sdk-akamai-base-ghp-badge]][sdk-akamai-base-ghp-link]
[![NPM][sdk-akamai-base-dm-badge]][sdk-akamai-base-npm-link]
[![NPM][sdk-akamai-base-dt-badge]][sdk-akamai-base-npm-link]

The LaunchDarkly Akamai SDK is designed primarily for use in Akamai Edgeworkers. It follows the server-side LaunchDarkly model for multi-user contexts. It is not intended for use in desktop and embedded systems applications.

For more information, see the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/edge/akamai).

## Install

```shell
npm i @launchdarkly/akamai-server-base-sdk
```

## Quickstart


See the full [example app](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/akamai-base/example).

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/akamai-base

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

[sdk-akamai-base-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-base.yml/badge.svg
[sdk-akamai-base-ci]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-base.yml
[sdk-akamai-base-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/akamai-server-base-sdk.svg?style=flat-square
[sdk-akamai-base-npm-link]: https://www.npmjs.com/package/@launchdarkly/akamai-server-base-sdk
[sdk-akamai-base-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-akamai-base-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/akamai-base/docs/
[sdk-akamai-base-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/akamai-server-base-sdk.svg?style=flat-square
[sdk-akamai-base-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/akamai-server-base-sdk.svg?style=flat-square
[package-sdk-akamai-base-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fakamai-base%22+