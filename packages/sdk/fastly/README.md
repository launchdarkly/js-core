# LaunchDarkly SDK for Fastly

[![NPM][sdk-fastly-npm-badge]][sdk-fastly-npm-link]
[![Actions Status][sdk-fastly-ci-badge]][sdk-fastly-ci]
[![Documentation][sdk-fastly-ghp-badge]][sdk-fastly-ghp-link]
[![NPM][sdk-fastly-dm-badge]][sdk-fastly-npm-link]
[![NPM][sdk-fastly-dt-badge]][sdk-fastly-npm-link]

The LaunchDarkly SDK for Fastly is designed for use in [Fastly Compute Platform](https://www.fastly.com/documentation/guides/compute/). It follows the server-side LaunchDarkly model for multi-user contexts. It is not intended for use in desktop and embedded systems applications.

## Install

```shell
# npm
npm i @launchdarkly/fastly-server-sdk

# yarn
yarn add @launchdarkly/fastly-server-sdk
```

## Usage notes

- The SDK must be initialized and used when processing requests, not during build-time initialization.
- The SDK caches all KV data during initialization to reduce the number of backend requests needed to fetch KV data. This means changes to feature flags or segments will not be picked up during the lifecycle of a single request instance.
- Events should flushed using the [`waitUntil()` method](https://js-compute-reference-docs.edgecompute.app/docs/globals/FetchEvent/prototype/waitUntil).

## Quickstart

See the full [example app](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/fastly/example).

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/fastly

# run tests
yarn test
```

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md).

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

[sdk-fastly-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/fastly.yml/badge.svg
[sdk-fastly-ci]: https://github.com/launchdarkly/js-core/actions/workflows/fastly.yml
[sdk-fastly-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/fastly-server-sdk.svg?style=flat-square
[sdk-fastly-npm-link]: https://www.npmjs.com/package/@launchdarkly/fastly-server-sdk
[sdk-fastly-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-fastly-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/fastly/docs/
[sdk-fastly-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/fastly-server-sdk.svg?style=flat-square
[sdk-fastly-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/fastly-server-sdk.svg?style=flat-square
