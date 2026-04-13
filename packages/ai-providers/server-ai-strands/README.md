# LaunchDarkly AI SDK Strands provider for Server-Side JavaScript

[![NPM][server-ai-strands-npm-badge]][server-ai-strands-npm-link]
[![Actions Status][server-ai-strands-ci-badge]][server-ai-strands-ci]
[![Documentation][server-ai-strands-ghp-badge]][server-ai-strands-ghp-link]
[![NPM][server-ai-strands-dm-badge]][server-ai-strands-npm-link]
[![NPM][server-ai-strands-dt-badge]][server-ai-strands-npm-link]

> [!CAUTION]
> This SDK is in pre-release and not subject to backwards compatibility
> guarantees. The API may change based on feedback.
>
> Pin to a specific minor version and review the [changelog](CHANGELOG.md) before upgrading.

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Overview

This package provides Strands-oriented building blocks for use with the [LaunchDarkly AI SDK](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-ai). Install it alongside `@launchdarkly/server-sdk-ai` when building or consuming Strands agents on Amazon Bedrock.

```shell
npm install @launchdarkly/server-sdk-ai @launchdarkly/server-sdk-ai-strands --save
```

For more information about using the LaunchDarkly AI SDK, see the [LaunchDarkly AI SDK documentation](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-ai/README.md).

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the 'gold' plan get access to more features than users in the 'silver' plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[server-ai-strands-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai-strands.yml/badge.svg
[server-ai-strands-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai-strands.yml
[server-ai-strands-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai-strands.svg?style=flat-square
[server-ai-strands-npm-link]: https://www.npmjs.com/package/@launchdarkly/server-sdk-ai-strands
[server-ai-strands-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[server-ai-strands-ghp-link]: https://launchdarkly.github.io/js-core/packages/ai-providers/server-ai-strands/docs/
[server-ai-strands-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/server-sdk-ai-strands.svg?style=flat-square
[server-ai-strands-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/server-sdk-ai-strands.svg?style=flat-square
