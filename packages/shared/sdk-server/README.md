# LaunchDarkly SDK JavaScript Common Server Code

[![NPM][js-server-sdk-common-npm-badge]][js-server-sdk-common-npm-link]
[![Actions Status][shared-sdk-server-ci-badge]][shared-sdk-server-ci]
[![Documentation][shared-sdk-server-ghp-badge]][shared-sdk-server-ghp-link]

This project contains Typescript classes and interfaces that are applicable to server-side SDKs.

## Contributing

See [Contributing](../CONTRIBUTING.md).

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md).

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[js-server-sdk-common-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/js-server-sdk-common.svg?style=flat-square
[js-server-sdk-common-npm-link]: https://www.npmjs.com/package/@launchdarkly/js-server-sdk-common
[shared-sdk-server-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server.yml/badge.svg
[shared-sdk-server-ci]: https://github.com/launchdarkly/js-core/actions/workflows/sdk-server.yml
[shared-sdk-server-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[shared-sdk-server-ghp-link]: https://launchdarkly.github.io/js-core/packages/shared/sdk-server/docs/
