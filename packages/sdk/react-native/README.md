# LaunchDarkly React Native SDK

[![NPM][sdk-react-native-npm-badge]][sdk-react-native-npm-link]
[![Actions Status][sdk-react-native-ci-badge]][sdk-react-native-ci]
[![Documentation][sdk-react-native-ghp-badge]][sdk-react-native-ghp-link]
[![NPM][sdk-react-native-dm-badge]][sdk-react-native-npm-link]
[![NPM][sdk-react-native-dt-badge]][sdk-react-native-npm-link]

The LaunchDarkly React Native SDK is designed primarily for use in mobile environments. It follows the client-side
LaunchDarkly model for multi-user contexts.

This SDK is a complete rewrite of the React Native SDK and replaces [launchdarkly-react-native-client-sdk](https://github.com/launchdarkly/react-native-client-sdk). The
APIs are based on the JS SDK rather than the iOS and Android SDKs. It is not a wrapper of the iOS and Android SDKs.
It is implemented purely in JS and supports Expo. Please consider updating your application to use this package instead.

For more information, see the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/client-side/react-native).

## Known Android identify issue

With Expo versions less than `51.0.21` and React Native versions less than `0.74.3`, the identify operation will not be complete in a debug configuration. If using Expo Go, you must ensure you have version `2.31.2` or greater.

This is the expo PR that resolved this issue: https://github.com/expo/expo/pull/30062

If you are using expo after that release, as well as a React Native version without flipper, then the SDK should be able to identify in debug mode. We specifically tried Expo version `51.0.21 ` with React Native `0.74.3`, but some other patch version combinations may work.

The SDK uses SSE streaming to get flag data and in React Native versions with Flipper, the network capture interferes with HTTP requests that are streamed through HTTP.

Expo also includes network debugging, which interfered with streaming responses before the above patch.

When running with `expo start`, which will run with Expo Go by default, the Expo Go binary includes the native expo code. This is why an Expo Go version which contains the relevant patch must be used.

If older versions of expo and RN are used, then a release build configuration can be used to work around this issue.

## Install

```shell
yarn add @launchdarkly/react-native-client-sdk
```

Additionally, the LaunchDarkly React-Native SDK uses
[@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage)
for bootstrapping. This is a native dependency.

If you are using expo, then installing this package from npm like above and re-running pod install should suffice.

If you are not using expo, you will need to explicitly add
@react-native-async-storage/async-storage as a dependency to your project
and re-run pod install for [auto-linking to work](https://github.com/react-native-community/cli/issues/1347).

## Quickstart

1. Wrap your application with `LDProvider` and set the `client` prop to an instance of `ReactNativeLDClient`. Call
   `identify` at a later time to get flags. In the example below, `identify` is called on App mount:

```tsx
// App.tsx
import { LDProvider, ReactNativeLDClient } from '@launchdarkly/react-native-client-sdk';

const featureClient = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled);
const userContext = { kind: 'user', key: 'test-user-1' };

const App = () => {
  useEffect(() => {
    featureClient.identify(userContext).then((result) => {
      if (result.status === 'error') {
        console.error(result.error);
      }
    });
  }, []);

  return (
    <LDProvider client={featureClient}>
      <YourComponent />
    </LDProvider>
  );
};

export default App;
```

2. Then in a child component, evaluate flags with `useBoolVariation`:

```jsx
import { useBoolVariation } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const flagValue = useBoolVariation('flag-key', false);

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>Flag value is {`${flagValue}`}</Text>
    </View>
  );
}
```

See the full [example app](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/react-native/example).

## Developing this SDK

1. Build all the code in the `js-core` repo:

```shell
# at js-core repo root
yarn && yarn build
```

2. The example app uses [react-native-dotenv](https://github.com/goatandsheep/react-native-dotenv)
   to manage environment variables. Under `packages/sdk/react-native/example`
   create an `.env` file and add your mobile key:

```shell
echo "MOBILE_KEY=mob-abc" >> packages/sdk/react-native/example/.env
```

3. Run the example app. This will link the local react-native sdk code to the
   example app for development:

```shell
# in react-native/example
yarn && yarn ios-go
```

## Privacy manifest

At WWDC23, Apple introduced the concept of Privacy Manifests. The privacy manifest describes our data usage with respect to the minimum case of data collection. You will have to update your own privacy manifest if you choose to collect more data in your implementation than the minimum for our SDK to function.

For the LaunchDarkly React Native SDK, you can use the [privacy manifest](https://github.com/launchdarkly/ios-client-sdk/blob/v9/LaunchDarkly/LaunchDarkly/PrivacyInfo.xcprivacy) included in the LaunchDarkly iOS Client SDK. The data usage information is the same for the two SDKs.

To learn more about Privacy Manifests, please refer to [Apple Developer Documentation](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_data_use_in_privacy_manifests).

To learn more about Privacy Manifests specifically for React Native, please refer to this [discussion](https://github.com/react-native-community/discussions-and-proposals/discussions/776).

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

[sdk-react-native-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml/badge.svg
[sdk-react-native-ci]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml
[sdk-react-native-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[sdk-react-native-npm-link]: https://www.npmjs.com/package/@launchdarkly/react-native-client-sdk
[sdk-react-native-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-react-native-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/react-native/docs/
[sdk-react-native-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[sdk-react-native-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/react-native-client-sdk.svg?style=flat-square
