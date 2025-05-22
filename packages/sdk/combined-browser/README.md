# LaunchDarkly JavaScript SDK for Browsers with included Observability.

[![NPM][combined-browser-sdk-npm-badge]][combined-browser-sdk-npm-link]
[![Actions Status][combined-browser-sdk-ci-badge]][combined-browser-sdk-ci]
[![Documentation][combined-browser-sdk-ghp-badge]][combined-browser-sdk-ghp-link]
[![NPM][combined-browser-sdk-dm-badge]][combined-browser-sdk-npm-link]
[![NPM][combined-browser-sdk-dt-badge]][combined-browser-sdk-npm-link]

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is a alpha version and should not be considered ready for production use while this message is visible.

# ☝️☝️☝️☝️☝️☝️

<!--
## Install

```shell
# npm
npm i @launchdarkly/browser

# yarn
yarn add -D @launchdarkly/browser
```
-->

## Getting started

Refer to the [SDK documentation](https://docs.launchdarkly.com/sdk/client-side/javascript#getting-started) for instructions on getting started with using the SDK.

Note: _If you are using JavaScript in a non-combined-browser environment, please check our other SDK packages in [js-core](https://github.com/launchdarkly/js-core)_
Please note that the JavaScript SDK has two special requirements in terms of your LaunchDarkly environment. First, in terms of the credentials for your environment that appear on your [Account Settings](https://app.launchdarkly.com/settings/projects) dashboard, the JavaScript SDK uses the "Client-side ID"-- not the "SDK key" or the "Mobile key". Second, for any feature flag that you will be using in JavaScript code, you must check the "Make this flag available to client-side SDKs" box on that flag's Settings page.

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

[combined-browser-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/combined-browser.yml/badge.svg
[combined-browser-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/combined-browser.yml
[combined-browser-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/browser.svg?style=flat-square
[combined-browser-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/browser
[combined-browser-sdk-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[combined-browser-sdk-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/combined-browser/docs/
[combined-browser-sdk-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/browser.svg?style=flat-square
[combined-browser-sdk-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/browser.svg?style=flat-square
