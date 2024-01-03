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

3. Replace `dev-test-flag` with your flag key in `src/welcome.tsx`.

4. Run the app:

```shell
# Note for android, there's an issue with Flipper interfering with streaming connections
# so please run the release build. There's no such issues with ios.

# ios
yarn && yarn ios-go

# android
yarn && yarn android-release
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
   and `my-boolean-flag-2` and they evaluate to true for `test-user`.

4. On a terminal:

```shell
yarn && yarn start
```

3. On another terminal:

```shell
yarn detox-ios
```
