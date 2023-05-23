# LaunchDarkly Akamai SDK

[![NPM][sdk-akamai-npm-badge]][sdk-akamai-npm-link]
[![Actions Status][sdk-akamai-ci-badge]][sdk-akamai-ci]
[![Documentation][sdk-akamai-ghp-badge]][sdk-akamai-ghp-link]
[![NPM][sdk-akamai-dm-badge]][sdk-akamai-npm-link]
[![NPM][sdk-akamai-dt-badge]][sdk-akamai-npm-link]

The LaunchDarkly Akamai SDK is designed primarily for use in Akamai Edgeworkers. It follows the server-side LaunchDarkly model for multi-user contexts. It is not intended for use in desktop and embedded systems applications.

For more information, see the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/server-side/akamai).

## Install

```shell
npm i @launchdarkly/akamai-server-sdk
```

Then turn on the Node.js compatibility flag in your `wrangler.toml`. This allows the SDK to use `node:events`:

```toml
compatibility_flags = [ "nodejs_compat" ]
```

## Quickstart


See the full [example app](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/akamai/example).

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build && cd packages/sdk/akamai

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

[sdk-akamai-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/akamai.yml/badge.svg
[sdk-akamai-ci]: https://github.com/launchdarkly/js-core/actions/workflows/akamai.yml
[sdk-akamai-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/akamai-server-sdk.svg?style=flat-square
[sdk-akamai-npm-link]: https://www.npmjs.com/package/@launchdarkly/akamai-server-sdk
[sdk-akamai-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-akamai-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/akamai/docs/
[sdk-akamai-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/akamai-server-sdk.svg?style=flat-square
[sdk-akamai-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/akamai-server-sdk.svg?style=flat-square
