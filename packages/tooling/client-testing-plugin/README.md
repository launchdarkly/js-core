# LaunchDarkly Client Testing Plugin

A testing plugin for LaunchDarkly client-side JavaScript SDKs. Use it to inject deterministic flag values into a real SDK client during unit tests, integration tests, and local development.

## Install

```bash
yarn add --dev @launchdarkly/client-testing-plugin @launchdarkly/js-client-sdk
```

## Usage

```ts
import { createClient } from '@launchdarkly/js-client-sdk';
import { TestData } from '@launchdarkly/client-testing-plugin';

// Seed with a base set of flag values.
const td = new TestData({
  'new-ui': true,
  greeting: 'Hello!',
});

const client = createClient(
  '<ldClientSideId>', // placeholder -- fill in only for real environments
  { kind: 'user', key: 'tester' },
  {
    plugins: [td],
    sendEvents: false,
    streaming: false,
  },
);

await client.start({ bootstrap: {} });

client.boolVariation('new-ui', false);          // true
client.stringVariation('greeting', '(default)'); // 'Hello!'

// Update flags at any time -- the SDK fires change events. Setters chain.
td.setBool('new-ui', false).setString('greeting', 'Welcome');
```

### Required LD client options
In order to successfully set up a LD client to use the testing plugin, you **MUST** set the following options:

- **`plugins: [td]`** - registers the testing plugin so it can inject overrides.
- **`sendEvents: false`** - keeps analytics events off in tests.
- **`streaming: false`** - (required for `js-client-sdk` and its derivativs, eg `react-sdk`), having streaming on will cause the `js-client-sdk` to automatically open a streaming connection.
- **`bootstrap: {}` (passed to `start()`)** -- gives the SDK an empty initial flag set so it does not block on a network identify call. The plugin's overrides are applied immediately afterward.

> Refer to the usage example above.

## API

### `TestData`

```ts
class TestData implements LDPlugin {
  constructor(initialFlags?: { [key: string]: LDFlagValue });

  setBool(key: string, value: boolean): this;
  setString(key: string, value: string): this;
  setNumber(key: string, value: number): this;
  setJson(key: string, value: object | unknown[]): this;

  remove(key: string): this;
  clear(): this;
}
```

- **`new TestData(initialFlags?)`** -- seed the instance with a base map of flag keys to values. The values are applied to the SDK client when it initializes.
- **`setBool` / `setString` / `setNumber` / `setJson`** -- set or update a single flag. If the SDK is already running, the change propagates immediately and listeners receive a `change:<key>` event. Every write applies the override, even when the value is unchanged -- mirroring a real connection that can re-deliver a flag and fire a `change` event without the value differing.
- **`remove(key)`** -- drop the override for a single key. If the SDK is connected, also calls `removeOverride`.
- **`clear()`** -- drop all overrides. Useful in `beforeEach` for shared `TestData` instances.
