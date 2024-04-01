# LaunchDarkly Akamai SDK for EdgeKV

[![NPM][sdk-akamai-edgekv-npm-badge]][sdk-akamai-edgekv-npm-link]
[![Actions Status][sdk-akamai-edgekv-ci-badge]][sdk-akamai-edgekv-ci]
[![Documentation][sdk-akamai-edgekv-ghp-badge]][sdk-akamai-edgekv-ghp-link]
[![NPM][sdk-akamai-edgekv-dm-badge]][sdk-akamai-edgekv-npm-link]
[![NPM][sdk-akamai-edgekv-dt-badge]][sdk-akamai-edgekv-npm-link]

The LaunchDarkly Akamai SDK is designed primarily for use in Akamai Edgeworkers. It follows the server-side LaunchDarkly model for multi-user contexts. It is not intended for use in desktop and embedded systems applications.

For more information, see the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/edge/akamai).

## Install

```shell
npm i @launchdarkly/akamai-server-edgekv-sdk
```

## Quickstart

See the full [example app](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/akamai-edgekv/example).

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/akamai-edgekv

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

[sdk-akamai-edgekv-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-edgekv.yml/badge.svg
[sdk-akamai-edgekv-ci]: https://github.com/launchdarkly/js-core/actions/workflows/akamai-edgekv.yml
[sdk-akamai-edgekv-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/akamai-server-edgekv-sdk.svg?style=flat-square
[sdk-akamai-edgekv-npm-link]: https://www.npmjs.com/package/@launchdarkly/akamai-server-edgekv-sdk
[sdk-akamai-edgekv-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-akamai-edgekv-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/akamai-edgekv/docs/
[sdk-akamai-edgekv-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/akamai-server-edgekv-sdk.svg?style=flat-square
[sdk-akamai-edgekv-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/akamai-server-edgekv-sdk.svg?style=flat-square
[package-sdk-akamai-edgekv-issues]: https://github.com/launchdarkly/js-core/issues?q=is%3Aissue+is%3Aopen+label%3A%22package%3A+sdk%2Fakamai-edgekv%22+
