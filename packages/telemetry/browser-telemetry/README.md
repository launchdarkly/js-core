# Telemetry integration for LaunchDarkly browser SDKs.

# ⛔️⛔️⛔️⛔️

> [!WARNING]
> This is an alpha version. The API is not stabilized and will introduce breaking changes.

[![NPM][browser-telemetry-npm-badge]][browser-telemetry-npm-link]
[![Actions Status][browser-telemetry-ci-badge]][browser-telemetry-ci]
[![Documentation][browser-telemetry-ghp-badge]][browser-telemetry-ghp-link]
[![NPM][browser-telemetry-dm-badge]][browser-telemetry-npm-link]
[![NPM][browser-telemetry-dt-badge]][browser-telemetry-npm-link]

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Compatibility

This package is compatible with the `launchdarkly-js-client-sdk` version 3.4.0 and later.

## Setup

### For error metric collection only

```
import { initialize } from "launchdarkly-js-client-sdk";
import { initTelemetry, register } from "@launchdarkly/browser-telemetry";

// Initialize the telemetry as early as possible in your application.
// Errors can be missed if they occur before the telemetry is initialized.
// For metrics only breadcrumbs and stack traces are not required.
initTelemetry({breadcrumbs: false, stack: false});

// Initialize the LaunchDarkly client.
const client = initialize('sdk-key', context);

// Register the client with the telemetry instance.
register(client);
```

### For error monitoring + metric collection

```
import { initialize } from "launchdarkly-js-client-sdk";
import { initTelemetry, register, inspectors } from "@launchdarkly/browser-telemetry";

// Initialize the telemetry as early as possible in your application.
// Errors can be missed if they occur before the telemetry is initialized.
initTelemetry();

// Initialize the LaunchDarkly client.
const client = initialize('sdk-key', context, {
  // Inspectors allows the telemetry SDK to capture feature flag information.
  inspectors: inspectors(),
});

// Register the client with the telemetry instance.
register(client);
```

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[browser-telemetry-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/browser-telemetry.yml/badge.svg
[browser-telemetry-ci]: https://github.com/launchdarkly/js-core/actions/workflows/browser-telemetry.yml
[browser-telemetry-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/browser-telemetry.svg?style=flat-square
[browser-telemetry-npm-link]: https://www.npmjs.com/package/@launchdarkly/browser-telemetry
[browser-telemetry-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[browser-telemetry-ghp-link]: https://launchdarkly.github.io/js-core/packages/telemetry/browser-telemetry/docs/
[browser-telemetry-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/browser-telemetry.svg?style=flat-square
[browser-telemetry-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/browser-telemetry.svg?style=flat-square
