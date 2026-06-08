# JavaScript Client SDKs — Release notes proposal (FDv2 EAP)

These notes cover the FDv2 "data saving mode" Early Access release for the three
JavaScript client-side SDKs. The configuration shape is shared, so this document
can be applied to each SDK's release notes with the per-SDK code samples below:

- `@launchdarkly/js-client-sdk` (browser)
- `@launchdarkly/react-sdk` (React Web)
- `@launchdarkly/react-native-client-sdk` (React Native)

## Data Saving Mode EAP

This release adds support for our second generation flag delivery protocol, also known as data saving mode.

These SDKs use the first generation flag delivery protocol unless you explicitly configure the new protocol.

Support for the new protocol is defined by a data system configuration. Setting the `dataSystem` option enables the new protocol.

The data system supports more flexible configuration for **initializers** (how the SDK gets an initial payload) and **synchronizers** (how it stays up to date).

> **This is an Early Access feature.** The `dataSystem` configuration surface is subject to change without notice and is not covered by the SDK's semantic-versioning guarantees until it graduates to GA. Existing applications that do not set `dataSystem` are unaffected.

The browser and React Web SDKs run in the browser and do not switch connection modes automatically based on application lifecycle or network state. The React Native SDK additionally switches modes automatically as the application moves between the foreground and background.

## JavaScript (`@launchdarkly/js-client-sdk`)

### Default

This is the LaunchDarkly-recommended default. An empty `dataSystem` opts in with default behavior: a streaming connection for real-time flag updates, with polling as a fallback.

```js
import { createClient } from '@launchdarkly/js-client-sdk';

const client = createClient('my-client-side-id', context, {
  dataSystem: {},
});
```

### Single connection mode

To keep the SDK in a single connection mode instead of letting it manage the connection, use manual mode switching and set the initial connection mode (`streaming`, `polling`, or `offline`):

```js
const client = createClient('my-client-side-id', context, {
  dataSystem: {
    automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' },
  },
});
```

To disable mode management entirely and use the platform default foreground mode, set `automaticModeSwitching: false`.

The browser SDK does not switch connection modes automatically; `automaticModeSwitching` accepts only `false` or a manual `{ type: 'manual', initialConnectionMode }`.

### Runtime control

You can change the connection mode at runtime with `client.setConnectionMode(mode)`. Pass `undefined` (or call with no arguments) to clear an explicit mode and return to managed behavior.

## React (`@launchdarkly/react-sdk`)

The React Web SDK is built on the browser SDK and accepts the same `dataSystem` configuration, passed through the provider's `ldOptions`. It does not switch connection modes automatically.

### Default

```js
import { createLDReactProvider } from '@launchdarkly/react-sdk';

export const LDReactProvider = createLDReactProvider('my-client-side-id', context, {
  ldOptions: { dataSystem: {} },
});
```

### Single connection mode

```js
export const LDReactProvider = createLDReactProvider('my-client-side-id', context, {
  ldOptions: {
    dataSystem: {
      automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' },
    },
  },
});
```

## React Native (`@launchdarkly/react-native-client-sdk`)

### Default

This is the LaunchDarkly-recommended default. An empty `dataSystem` uses streaming in the foreground for real-time flag updates and polling in the background, switching automatically as the application moves between the foreground and background.

```js
import { AutoEnvAttributes, ReactNativeLDClient } from '@launchdarkly/react-native-client-sdk';

const client = new ReactNativeLDClient('my-mobile-key', AutoEnvAttributes.Enabled, {
  dataSystem: {},
});
```

### Single connection mode

To keep the SDK in a single connection mode regardless of lifecycle changes, disable automatic switching:

```js
const client = new ReactNativeLDClient('my-mobile-key', AutoEnvAttributes.Enabled, {
  dataSystem: { automaticModeSwitching: false },
});
```

You can also pin a specific initial mode with manual switching:

```js
const client = new ReactNativeLDClient('my-mobile-key', AutoEnvAttributes.Enabled, {
  dataSystem: {
    automaticModeSwitching: { type: 'manual', initialConnectionMode: 'streaming' },
  },
});
```

### Automatic mode switching

By default the SDK switches modes automatically based on application lifecycle, as the application moves between the foreground and background. You can turn lifecycle-driven switching off with a granular configuration:

```js
const client = new ReactNativeLDClient('my-mobile-key', AutoEnvAttributes.Enabled, {
  dataSystem: {
    automaticModeSwitching: { type: 'automatic', lifecycle: false },
  },
});
```

### Runtime control

`client.setConnectionMode(mode)` changes the connection mode at runtime. Pass `undefined` to return to automatic behavior.

## Opting into FDv2

These SDKs default to the first generation (FDv1) protocol. Setting the `dataSystem` option opts into FDv2; omitting it leaves the SDK on FDv1. This is the single switch between protocols -- there is no separate "use FDv2" flag.

## Notes for the author of the release commits

- Each package releases independently via release-please. Use a `feat: ...` conventional commit (the EAP work landed as `feat: Prepare FDv2 EAP for browser and React Native SDKs`) so release-please bumps the minor and the changelog wording matches the cross-SDK convention.
- Projected EAP versions -- confirm against whatever release-please has already cut by EAP day, and update before publishing:
  - `@launchdarkly/js-client-sdk`: 4.9.x (current 4.8.0)
  - `@launchdarkly/react-sdk`: 4.2.x (current 4.1.0)
  - `@launchdarkly/react-native-client-sdk`: 10.19.x (current 10.18.0)
- The React Web SDK receives `dataSystem` through its dependency on `@launchdarkly/js-client-sdk` (its `LDReactClientOptions` extends the browser `LDOptions`); make sure its js-client-sdk dependency range includes the EAP version.
- Plain npm release -- no prerelease tag. (Mirror Android's [SDK-2440](https://launchdarkly.atlassian.net/browse/SDK-2440) approach if there is a JS equivalent ticket.)
