# LaunchDarkly Electron SDK

<!--
[![NPM][npm-badge]][npm-link]
[![Actions Status][ci-badge]][ci-link]
[![Documentation][ghp-badge]][ghp-link]
[![NPM][npm-dm-badge]][npm-link]
[![NPM][npm-dt-badge]][npm-link]
-->

> [!CAUTION]
> This SDK is experimental and should NOT be considered ready for production use.
> It may change or be removed without notice and is not subject to backwards
> compatibility guarantees.

<!--
> Pin to a specific minor version and review the [changelog](link-to-changelog) before upgrading.
-->

## Getting started

Install the SDK next to Electron (Electron 34.5.6 or later is a peer dependency):

```sh
npm install @launchdarkly/electron-client-sdk
```

The LaunchDarkly client runs in the **main process**. Renderer windows do not connect to
LaunchDarkly directly. They call the main-process client over IPC through a small preload bridge.

Main process:

```ts
import { createClient } from '@launchdarkly/electron-client-sdk';

const client = createClient(mobileKey, { kind: 'user', key: 'user-key' });
await client.start();

const showFeature = client.boolVariation('my-flag', false);
```

Preload script (set as `webPreferences.preload` on the `BrowserWindow`):

```ts
import '@launchdarkly/electron-client-sdk/bridge';
```

Renderer:

```ts
import { createRendererClient } from '@launchdarkly/electron-client-sdk/renderer';

const client = createRendererClient(mobileKey);
await client.waitForInitialization();

const showFeature = client.boolVariation('my-flag', false);
```

`createClient` returns a client that is not ready until `start()` resolves. `identify()` returns a
result object and never throws.

## Documentation

- [Feature guide](temp_docs/README.md): credentials and secure mode, connection modes, network
  availability, data source status, flag cache storage, multiple windows and clients, proxies, and
  the Relay Proxy.
- [SDK reference page draft](temp_docs/electron.mdx): the draft of the page for the LaunchDarkly
  docs site.
- [Migration guide](temp_docs/MIGRATION.md): the changes from the previous Electron SDK.
- [IPC bridge design](temp_docs/ipc-bridge.md): how renderer windows use the main-process client.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the 'gold' plan get access to more features than users in the 'silver' plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

<!--
NOTE: this is just copied from shopify sdk for now
[npm-badge]: https://img.shields.io/npm/v/@launchdarkly/shopify-oxygen-sdk.svg?style=flat-square
[npm-link]: https://www.npmjs.com/package/@launchdarkly/shopify-oxygen-sdk
[npm-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/shopify-oxygen-sdk.svg?style=flat-square
[npm-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/shopify-oxygen-sdk.svg?style=flat-square
[ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/shopify-oxygen.yml/badge.svg
[ci-link]: https://github.com/launchdarkly/js-core/actions/workflows/shopify-oxygen.yml
[ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/shopify-oxygen/docs/
-->
