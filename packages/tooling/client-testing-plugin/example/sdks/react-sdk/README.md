# Client Testing Plugin - React SDK example

A working unit-test pattern for the LaunchDarkly React SDK (v4) using
`@launchdarkly/client-testing-plugin`. This is the recommended replacement
for the deprecated `jest-launchdarkly-mock`.

> **Test-only dependency.** `@launchdarkly/client-testing-plugin` must never
> ship to production. It overrides flag evaluation locally and bypasses the
> normal LaunchDarkly evaluation path. Add it as a `devDependency` only, and
> do not register it on a production client. See the parent
> [`Status & limitations`](../../../README.md) section for the full caveats.

## Layout

This example lives under `example/sdks/react-sdk/`. The `sdks/<sdk-name>/`
depth is intentional: future examples (browser, electron, react-native) will
sit alongside this one under `example/sdks/`.

## Run the tests

From the repository root:

```bash
yarn install
yarn workspace @launchdarkly/client-testing-plugin-react-sdk-example test
```

## What's in the example

- [`src/Banner.tsx`](./src/Banner.tsx) - a tiny React component that reads
  `show-banner` and `greeting` from the React SDK via the typed variation
  hooks (`useBoolVariation`, `useStringVariation`).
- [`src/__tests__/Banner.test.tsx`](./src/__tests__/Banner.test.tsx) - Jest +
  `@testing-library/react` tests that drive the component through `TestData`.

## The canonical idiom

```tsx
import { render, screen } from '@testing-library/react';
import { TestData } from '@launchdarkly/client-testing-plugin';
import { createClient, createLDReactProviderWithClient } from '@launchdarkly/react-sdk';

const td = new TestData();
td.update(td.flag('show-banner').booleanFlag().variationForAll(true));
td.update(td.flag('greeting').stringFlag('Welcome'));

const client = createClient(
  '<ldClientSideId>', // placeholder - the plugin serves all flag values locally
  { kind: 'user', key: 'tester' },
  {
    plugins: [td],
    sendEvents: false,
    streaming: false,
  },
);
await client.start({ bootstrap: {} });

const LDProvider = createLDReactProviderWithClient(client);

render(
  <LDProvider>
    <Banner />
  </LDProvider>,
);
```

### Why `createClient` comes from `@launchdarkly/react-sdk`

The React SDK re-exports its own `createClient` that is distinct from the
`createClient` exported by `@launchdarkly/js-client-sdk`. Use the React SDK
variant in this example because it returns a client that
`createLDReactProviderWithClient` can wrap directly. Importing from
`@launchdarkly/js-client-sdk` works at the type level but skips the React
SDK's internal wiring and is not what we recommend for component tests.

### Why each option matters

- `plugins: [td]` registers the testing plugin so it can inject overrides.
- `sendEvents: false` keeps analytics events off in tests.
- `streaming: false` prevents the SDK from auto-starting a streaming
  connection when a `change` listener is registered (the React provider
  registers internal change listeners). Without this, the test would attempt
  a real network call to `clientstream.launchdarkly.com`.
- `bootstrap: {}` (passed to `start()`) gives the SDK an empty initial flag
  set so it does not block on a network identify call. The plugin's
  overrides are applied immediately afterward.

## Updating flag values after the component has rendered

The canonical idiom above shows static setup: every flag value is in place
before `render()` is called. Real test suites often need to change a flag
value mid-test and assert the component re-renders. Because the React SDK
propagates flag changes asynchronously, wrap the `td.update(...)` call in
`act` and use `findByText` (or any other `findBy*` query) to wait for the
new render:

```tsx
import { act } from '@testing-library/react';

// initial render with greeting = 'Welcome'
expect(screen.getByRole('banner')).toHaveTextContent('Welcome');

await act(async () => {
  td.update(td.flag('greeting').stringFlag('Updated greeting'));
});

expect(await screen.findByText('Updated greeting')).toBeInTheDocument();
```

Without `act`, React Testing Library will warn that state updates were not
wrapped, and the assertion may run before the re-render lands.

## Test isolation

Each test in this example builds a fresh `TestData` in `beforeEach` so flag
state never leaks across tests. If you prefer to share a single `TestData`
across many `it()` blocks, call `td.clear()` in `beforeEach` instead.

## See also

- [`@launchdarkly/client-testing-plugin` README](../../../README.md) - full
  API documentation, the list of supported flag kinds, and the broader
  rationale for the plugin.
