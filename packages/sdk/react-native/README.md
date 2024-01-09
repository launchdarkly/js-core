# LaunchDarkly React Native SDK

[![NPM][sdk-react-native-npm-badge]][sdk-react-native-npm-link]
[![Actions Status][sdk-react-native-ci-badge]][sdk-react-native-ci]
[![Documentation][sdk-react-native-ghp-badge]][sdk-react-native-ghp-link]
[![NPM][sdk-react-native-dm-badge]][sdk-react-native-npm-link]
[![NPM][sdk-react-native-dt-badge]][sdk-react-native-npm-link]

> [!WARNING]  
> UNSUPPORTED This SDK is in pre-release development and is not supported.

The LaunchDarkly React Native SDK is designed primarily for use in mobile environments. It follows the client-side LaunchDarkly model for multi-user contexts.

This SDK is a replacement of [launchdarkly-react-native-client-sdk](https://github.com/launchdarkly/react-native-client-sdk). Please consider updating your application to use this package instead.

For more information, see the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/client-side/react-native).

This library is an alpha version and should not be considered ready for production use while this message is visible.

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

1. Wrap your application with `LDProvider` passing it an LDClient and
   an LDContext:

```jsx
// App.tsx
import { LDProvider, ReactNativeLDClient } from '@launchdarkly/react-native-client-sdk';

const featureClient = new ReactNativeLDClient('mobile-key');
const userContext = { kind: 'user', key: 'test-user-1' };

const App = () => (
  <LDProvider client={featureClient} context={userContext}>
    <Welcome />
  </LDProvider>
);

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

## Validating SDK packages with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) to help developers make their supply chain more secure by ensuring the authenticity of our published SDK packages. As part of [SLSA requirements for level 3 compliance](https://slsa.dev/spec/v1.0/requirements), LaunchDarkly publishes provenance about our SDK package builds to NPM for distribution alongside our packages. 

The SLSA framework specifies some [recommendations for verifying build artifacts](https://slsa.dev/spec/v1.0/verifying-artifacts) in their documentation. For npm packages that are published with provenance, npm already [validates the authenticity of the package using Sigstore](https://docs.npmjs.com/generating-provenance-statements#about-npm-provenance). In addition to npm's validation, we recommend the following steps:
- Ensure that the @launchdarkly/react-native-client-sdk version you're downloading was published with npm-verified provenance  
  - Check the [versions tab in npm](https://www.npmjs.com/package/@launchdarkly/react-native-client-sdk?activeTab) and ensure the version you're installing has a green checkmark 
- Use the provenance published in npm to verify the authenticity of the build:
  - Check the source commit for: 
    - Source repository is a LaunchDarkly-owned repository
    - Commit author is a LaunchDarkly entity
    - (Optional) Code changes in the commit are trustworthy
  - Check the build file and build summary for:
    - Build is triggered by a LaunchDarkly-owned repository
    - Build is executed by a LaunchDarkly-owned Github Actions workflow 
    - Build steps are trustworthy
  - Check the public ledger's transparency log entry to ensure the build provenance is authentic:
    - Signature issuer is Sigstore 
    - OIDC issuer is `https://token.actions.githubusercontent.com`
    - GitHub Workflow Repository is a LaunchDarkly-owned repository
    - GitHub Workflow SHA matches the SHA of the source commit

The recommendations above may be adjusted to fit your organization's needs and supply chain security policies. For additional questions, please contact [security@launchdarkly.com](mailto:security@launchdarkly.com).

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
