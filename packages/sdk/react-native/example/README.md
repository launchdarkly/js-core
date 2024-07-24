# LaunchDarkly React Native SDK example app

## Quickstart

1. At the js-core repo root:

```shell
yarn && yarn build
```

2. Create an `.env` file at the same level as this README and add your mobile key to that `.env` file:

```shell
MOBILE_KEY=abcdef12456
```

3. Replace `my-boolean-flag-1` with your flag key in `src/welcome.tsx`.

4. Run the app:

```shell
# ios
yarn && yarn ios

# Note: You may need to open the resulting XCode workspace to install the correct target development platform.
# You can use "yarn ios -- --device <device-id or name>" to build for a specific device.
# Note: To use Expo Go instead run "yarn ios-go"

# android
yarn && yarn android

# Note: If you downgrade the React Native or Expo versions used by this example the android build may not work in debug.
```

## Running Detox e2e tests

1. Install the required tools on OS X:

```shell
npm install detox-cli --global
brew tap wix/brew
brew install applesimutils
```

2. Detox uses the example app to run tests. The example app needs a mobile key set in an `.env` file
   at the same level as this README. Ensure this file exists and add your mobile key to that `.env` file:

```shell
MOBILE_KEY=abcdef12456
```

3. For the above mobile key, ensure two boolean flags exist `my-boolean-flag-1`
   and `my-boolean-flag-2` and they evaluate to true for `test-user`. Make sure these flags have client-side SDK availability checked for mobile sdks.

4. In the example folder, on a terminal:

```shell
yarn test
```
