# LaunchDarkly React Native SDK - FDv2 Example App

This is a minimal example app that demonstrates the experimental FDv2 data system
for the React Native SDK.

> **Note:** FDv2 support is `@internal` and experimental. It is not ready for
> production use and may change or be removed without notice.

## Features Demonstrated

- SDK initialization with the `dataSystem` option (FDv2 protocol)
- Connection mode switching for all FDv2 modes:
  - **Streaming** - real-time flag updates with polling fallback
  - **Polling** - periodic polling only
  - **Offline** - cached flags only, no network
  - **One-Shot** - initialize then stop (no persistent synchronizer)
  - **Background** - low-frequency polling for background state
  - **Automatic** - clear the override and use automatic mode selection
- Context identification
- Boolean flag evaluation

## Quickstart

1. At the js-core repo root, install dependencies and build:

```shell
yarn && yarn build
```

2. Create an `.env` file in this directory (`example-fdv2/`) with your mobile key:

```shell
MOBILE_KEY=mob-your-mobile-key-here
```

3. Update the flag key in `src/welcome.tsx` if needed (defaults to `sample-feature`).

4. Run the app:

```shell
# iOS
yarn ios

# Android
yarn android
```

> **Note:** You may need to run `npx expo prebuild` before the first iOS or
> Android build.

## Caveats

- **Network-based automatic mode switching** is not yet implemented. The wiring
  is in place, but `RNStateDetector` does not yet emit network state changes.
  Lifecycle-based switching (foreground/background) works.
- The `dataSystem` option and `setConnectionMode()` are marked `@internal` and
  require `@ts-ignore` to use from TypeScript.
