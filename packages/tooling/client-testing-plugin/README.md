# LaunchDarkly Client Testing Plugin

[![NPM][client-testing-plugin-npm-badge]][client-testing-plugin-npm-link]
[![Actions Status][client-testing-plugin-ci-badge]][client-testing-plugin-ci]
[![Documentation][client-testing-plugin-ghp-badge]][client-testing-plugin-ghp-link]
[![NPM][client-testing-plugin-dm-badge]][client-testing-plugin-npm-link]
[![NPM][client-testing-plugin-dt-badge]][client-testing-plugin-npm-link]

> [!CAUTION]
> This plugin is in pre-release and not subject to backwards compatibility
> guarantees. The API may change based on feedback.
>
> Pin to a specific minor version and review the [changelog](CHANGELOG.md) before upgrading.

A testing plugin for LaunchDarkly client-side JavaScript SDKs. Use it to inject deterministic flag values into a real SDK client during unit tests, integration tests, and local development.

## Install

```bash
yarn add --dev @launchdarkly/client-testing-plugin
```

You also need the client-side SDK you're testing against. The plugin declares each supported SDK as an optional peer dependency, so only install the one you use:

```bash
# pick one
yarn add --dev @launchdarkly/js-client-sdk
yarn add --dev @launchdarkly/react-sdk
```

## Usage

The plugin ships a small per-SDK wrapper under a subpath export. Each wrapper returns a real SDK client with `TestData` already registered and the required test settings applied -- no boilerplate.

### `@launchdarkly/js-client-sdk`

```ts
import { createTestClient } from '@launchdarkly/client-testing-plugin/js-client-sdk';

const { client, testData } = createTestClient(
  { kind: 'user', key: 'tester' },
  { 'new-ui': true, greeting: 'Hello!' },
);

await client.start({ bootstrap: {} });

client.boolVariation('new-ui', false);          // true
client.stringVariation('greeting', '(default)'); // 'Hello!'

// Update flags at any time - the SDK fires change events. Setters chain.
testData.setBool('new-ui', false).setString('greeting', 'Welcome');
```

### `@launchdarkly/react-sdk`

```ts
import { createTestClient } from '@launchdarkly/client-testing-plugin/react-sdk';
import { createLDReactProviderWithClient } from '@launchdarkly/react-sdk';

const { client, testData } = createTestClient(
  { kind: 'user', key: 'tester' },
  { 'show-banner': true, greeting: 'Welcome' },
);

await client.start({ bootstrap: {} });

const LDProvider = createLDReactProviderWithClient(client);
render(<LDProvider><MyComponent /></LDProvider>);

// Drive UI updates by mutating testData in `act(...)`.
testData.setString('greeting', 'Updated');
```

A runnable example lives under [`example/sdks/react-sdk/`](./example/sdks/react-sdk/).

## Manual setup (advanced)

If you need to wire `TestData` into an SDK the plugin does not yet provide a wrapper for, or you want full control over client options, register `TestData` as a plugin yourself:

```ts
import { createClient } from '@launchdarkly/js-client-sdk';
import { TestData } from '@launchdarkly/client-testing-plugin';

const td = new TestData({ 'new-ui': true });

const client = createClient(
  '<ldClientSideId>',
  { kind: 'user', key: 'tester' },
  {
    plugins: [td],
    sendEvents: false,
    streaming: false,
  },
);

await client.start({ bootstrap: {} });
```

The required SDK settings when wiring manually:

- **`plugins: [td]`** -- registers the testing plugin so it can inject overrides.
- **`sendEvents: false`** -- keeps analytics events off in tests.
- **`streaming: false`** -- (required for `js-client-sdk` and its derivatives, e.g. `react-sdk`); leaving streaming on causes the SDK to open a streaming connection.
- **`bootstrap: {}`** -- passed to `start()`; gives the SDK an empty initial flag set so initialization does not block on a network identify call. The plugin's overrides are applied immediately afterward.

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

[client-testing-plugin-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/client-testing-plugin.yml/badge.svg
[client-testing-plugin-ci]: https://github.com/launchdarkly/js-core/actions/workflows/client-testing-plugin.yml
[client-testing-plugin-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/client-testing-plugin.svg?style=flat-square
[client-testing-plugin-npm-link]: https://www.npmjs.com/package/@launchdarkly/client-testing-plugin
[client-testing-plugin-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[client-testing-plugin-ghp-link]: https://launchdarkly.github.io/js-core/packages/tooling/client-testing-plugin/docs/
[client-testing-plugin-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/client-testing-plugin.svg?style=flat-square
[client-testing-plugin-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/client-testing-plugin.svg?style=flat-square
