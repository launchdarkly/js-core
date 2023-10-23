# LaunchDarkly React Native SDK

:warning: UNSUPPORTED This SDK is in pre-release development and is not supported.

[![NPM][sdk-react-native-npm-badge]][sdk-react-native-npm-link]
[![Actions Status][sdk-react-native-ci-badge]][sdk-react-native-ci]
[![Documentation][sdk-react-native-ghp-badge]][sdk-react-native-ghp-link]
[![NPM][sdk-react-native-dm-badge]][sdk-react-native-npm-link]
[![NPM][sdk-react-native-dt-badge]][sdk-react-native-npm-link]

The LaunchDarkly React Native SDK is designed primarily for use in mobile environments. It follows the client-side LaunchDarkly model for multi-user contexts.

This SDK is a replacement of [launchdarkly-react-native-client-sdk](https://github.com/launchdarkly/react-native-client-sdk). Please consider updating your application to use this package instead.

For more information, see the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/client-side/react-native).

## Install

```shell
yarn add @launchdarkly/react-native-client-sdk
```

## Quickstart

TODO

```typescript
import { init } from '@launchdarkly/react-native-client-sdk';

// TODO
```

See the full [example app](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-native/example).

## Developing this SDK

```shell
# at js-core repo root
yarn && yarn build

# run android or ios app
yarn android | ios
```

Then run the sdk code in the example app. See the [README](https://github.com/launchdarkly/js-core/blob/main/packages/sdk/react-native/example/README.md#L1).

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

[sdk-react-native-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml/badge.svg
[sdk-react-native-ci]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml
[sdk-react-native-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[sdk-react-native-npm-link]: https://www.npmjs.com/package/@launchdarkly/react-native-client-sdk
[sdk-react-native-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-react-native-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/react-native/docs/
[sdk-react-native-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[sdk-react-native-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/react-native-client-sdk.svg?style=flat-square
