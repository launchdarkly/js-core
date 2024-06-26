# LaunchDarkly Universal SDK

[![NPM][universal-sdk-npm-badge]][universal-sdk-npm-link]
[![Actions Status][universal-sdk-ci-badge]][universal-sdk-ci]
[![Documentation][universal-sdk-ghp-badge]][universal-sdk-ghp-link]
[![NPM][universal-sdk-dm-badge]][universal-sdk-npm-link]
[![NPM][universal-sdk-dt-badge]][universal-sdk-npm-link]

> [!CAUTION]
> This library is a beta version and should not be considered ready for production use while this message is visible.

> **Easily unit test LaunchDarkly applications with universal-sdk** :clap:

For more information, see the [complete reference guide for unit testing](https://docs.launchdarkly.com/guides/sdk/unit-tests).

## Installation

```shell
# npm
npm i @launchdarkly/universal-sdk --save-dev

# yarn
yarn add -D @launchdarkly/universal-sdk
```

Then in `universal-sdk.config.js` add `@launchdarkly/universal-sdk/{framework}` to setupFiles:

```js
// universal-sdk.config.js
module.exports = {
  // for react
  setupFiles: ['@launchdarkly/universal-sdk/react'],

  // for react-native
  setupFiles: ['@launchdarkly/universal-sdk/react-native'],
};
```

## Quickstart

TODO:

## Developing this package

```shell
# at js-core repo root
yarn && yarn build && cd packages/tooling/universal-sdk

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
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[universal-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/universal-sdk.yml/badge.svg
[universal-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/universal-sdk.yml
[universal-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/universal-sdk.svg?style=flat-square
[universal-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/universal-sdk
[universal-sdk-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[universal-sdk-ghp-link]: https://launchdarkly.github.io/js-core/packages/tooling/universal-sdk/docs/
[universal-sdk-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/universal-sdk.svg?style=flat-square
[universal-sdk-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/universal-sdk.svg?style=flat-square
