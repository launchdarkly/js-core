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

On Android, Flipper interferes with the SDK's streaming connections. As a result the `identify` call never resolves. The long term solution is the removal of Flipper from react-native. The Facebook team are [working on this](https://reactnative.dev/blog/2023/12/06/0.73-debugging-improvements-stable-symlinks#flipper--react-native-integration).

In the meantime, we recommend one of these workarounds:

- If you are using Expo, you'll need to do a native build in release `expo run:android --variant release`.

- If you are using Expo and want to debug and hot reload, you'll need to do a native build in debug `expo run:android --variant debug` and then go to the `android` folder and manually find and remove all references to flipper. This is a [reported issue](https://github.com/facebook/flipper/issues/1326#issuecomment-652946496) in the Flipper repo.

- If you are using the expo-go app on Android, unfortunately there is no known easy way to disable Flipper in Expo Go. Please use one of two previous native build options.

- If you are not using Expo, go to the `android` folder and manually find and remove all references to flipper.

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
    featureClient.identify(userContext).catch((e) => console.error(e));
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

Please use the [privacy manifest](https://github.com/launchdarkly/ios-client-sdk/blob/v9/LaunchDarkly/LaunchDarkly/PrivacyInfo.xcprivacy) included in the LaunchDarkly iOS Client SDK.

At WWDC23, Apple introduced the concept of Privacy Manifests. The privacy manifest included with the LaunchDarkly iOS Client SDK describes our data usage with respect to the minimum case of data collection. You will have to update your own privacy manifest if you choose to collect more data in your implementation than the minimum for our SDK to function.

To learn more about Privacy Manifests, please refer to [Apple Developer Documention.](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_data_use_in_privacy_manifests).

To learn more about Privacy Manifests specifically in terms of react-native, please refer to this [discussion](https://github.com/react-native-community/discussions-and-proposals/discussions/776).

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
