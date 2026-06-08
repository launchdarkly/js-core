# LaunchDarkly Vue SDK

[![Actions Status][vue-sdk-ci-badge]][vue-sdk-ci]
<!-- Badges below are commented out until the package is published to npm and docs are deployed.
[![NPM][vue-sdk-npm-badge]][vue-sdk-npm-link]
[![Documentation][vue-sdk-ghp-badge]][vue-sdk-ghp-link]
[![NPM][vue-sdk-dm-badge]][vue-sdk-npm-link]
[![NPM][vue-sdk-dt-badge]][vue-sdk-npm-link]
-->

> [!CAUTION]
> This SDK is experimental and should NOT be considered ready for production use.
> It may change or be removed without notice and is not subject to backwards
> compatibility guarantees.
>
> Pin to a specific minor version and review the [changelog](CHANGELOG.md) before upgrading.

## Getting started

Refer to the [SDK documentation](https://launchdarkly.com/docs/sdk/client-side/vue) for instructions on getting started with using the SDK.

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](../../../PROVENANCE.md).

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

[vue-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/vue.yml/badge.svg
[vue-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/vue.yml
<!-- Badge link definitions below are commented out until the package is published.
[vue-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/vue-client-sdk.svg?style=flat-square
[vue-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/vue-client-sdk
[vue-sdk-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[vue-sdk-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/vue/docs/
[vue-sdk-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/vue-client-sdk.svg?style=flat-square
[vue-sdk-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/vue-client-sdk.svg?style=flat-square
-->
