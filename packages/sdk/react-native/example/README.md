## LaunchDarkly React Native SDK example app

To run the example app:

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
