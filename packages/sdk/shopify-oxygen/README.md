LaunchDarkly Server SDK for Shopify Oxygen Runtimes
===========================

<!-- TODO nothing is live yet
[![NPM][npm-badge]][npm-link]
[![Actions Status][ci-badge]][ci-link]
[![Documentation][ghp-badge]][ghp-link]
[![NPM][npm-dm-badge]][npm-link]
[![NPM][npm-dt-badge]][npm-link]
-->

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> *This version of the SDK is a **beta** version and should not be considered ready for production use while this message is visible.*

# ☝️☝️☝️☝️☝️☝️

LaunchDarkly overview
-------------------------
[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves trillions feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

Supported Oxygen runtime versions
-------------------------

This version of the LaunchDarkly SDK has been tested with Oxygen compatibility date `2025-01-01`.
> Check [worker compatibility date](https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/oxygen-runtime#worker-compatibility-flags)

Getting started
-----------

<!-- TODO no LD documentation yet
Refer to the [SDK documentation](https://docs.launchdarkly.com/sdk/client-side/android#getting-started) for instructions on getting started with using the SDK.
-->

Install this package:
```
npm install @launchdarkly/shopify-oxygen-sdk --save
```

Import the module
```
import {init} from '@launchdarkly/shopify-oxygen-sdk';
```

Declare required variables
```
const sdkKey = 'your-sdk-key';
const options = {};

const flagKey = 'your-flag';
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'tester',
};
const defaultValue = false;
```

Basic SDK usage example
```
const ldClient = await init(sdkKey, options);
await ldClient.waitForInitialization({timeout: 10});
const flagValue = await ldClient.variation(flagKey, context, defaultValue);
```

Options
-----------
The SDK accepts an `options` object as its second argument to `init(sdkKey, options)`. The supported options for this SDK are shown below.

### cache

`cache` defines how this SDK interacts with [Oxygen's native cache api](https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/oxygen-runtime#cache-api).

| Option        | Type     | Default | Description                                      |
| ------------- | -------- | ------- | ------------------------------------------------ |
| `ttlSeconds`  | number   | 30      | Time-to-live for cache entries, in seconds.      |
| `name`        | string   | 'launchdarkly-cache' | Name for the cache instance.    |
| `enabled`     | boolean  | true    | Whether caching is enabled.                      |

Example:
```js
const options = {
  cache: {
    ttlSeconds: 60, // cache values for 60 seconds within the request
    name: 'my-custom-cache',
    enabled: true,
  }
}
```

### logger

By default, the SDK uses an internal logger for diagnostic output. You may provide your own logger by specifying a compatible logger object under `logger`.

| Option   | Type   | Default                       | Description                            |
|----------|--------|------------------------------|----------------------------------------|
| logger   | object | a basic internal logger      | Optional custom logger implementation. |

Example:
```js
const options = {
  logger: myCustomLogger, // must match the LD logger interface
}
```
---
See the source for default values and logic:
- [validateOptions.ts](./src/utils/validateOptions.ts)
- [createOptions.ts](./src/utils/createOptions.ts)


<!-- TODO add in reference to example -->

Learn more
-----------

Read our [documentation](https://docs.launchdarkly.com) for in-depth instructions on configuring and using LaunchDarkly.

<!-- TODO nothing is generated yet
You can also head straight to the [complete reference guide for this SDK](https://docs.launchdarkly.com/sdk/server-side/java) or our [code-generated API documentation](https://launchdarkly.github.io/java-server-sdk/).
-->

Testing
-------

We run integration tests for all our SDKs using a centralized test harness. This approach gives us the ability to test for consistency across SDKs, as well as test networking behavior in a long-running application. These tests cover each method in the SDK, and verify that event sending, flag evaluation, stream reconnection, and other aspects of the SDK all behave correctly.

Contributing
------------

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](../../../CONTRIBUTING.md) for instructions on how to contribute to this SDK.

About LaunchDarkly
-----------

* LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard.  With LaunchDarkly, you can:
    * Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
    * Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
    * Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
    * Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
* LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/docs) for a complete list.
* Explore LaunchDarkly
    * [launchdarkly.com](https://www.launchdarkly.com/ "LaunchDarkly Main Website") for more information
    * [docs.launchdarkly.com](https://docs.launchdarkly.com/  "LaunchDarkly Documentation") for our documentation and SDK reference guides
    * [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/  "LaunchDarkly API Documentation") for our API documentation
    * [launchdarkly.com/blog](https://launchdarkly.com/blog/  "LaunchDarkly Blog Documentation") for the latest product updates

<!-- TODO nothing is live yet
[ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml/badge.svg
[ci-link]: https://github.com/launchdarkly/js-core/actions/workflows/react-native.yml
[npm-badge]: https://img.shields.io/npm/v/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[npm-link]: https://www.npmjs.com/package/@launchdarkly/react-native-client-sdk
[ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/react-native/docs/
[npm-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/react-native-client-sdk.svg?style=flat-square
[npm-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/react-native-client-sdk.svg?style=flat-square
-->