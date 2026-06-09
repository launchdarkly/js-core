# Client Testing Plugin - React SDK example

A working unit-test pattern for the LaunchDarkly React SDK using
`@launchdarkly/client-testing-plugin`. This is the recommended replacement
for the deprecated `jest-launchdarkly-mock`.

> See the plugin [README](../../../../tooling/client-testing-plugin/README.md) for the full
> documentation.

## Run the tests

From the repository root:

```bash
yarn install
yarn workspace @launchdarkly/react-sdk-example-testing test
```

## What's in the example

- [`src/Banner.tsx`](./src/Banner.tsx) - a tiny React component that reads
  `show-banner` and `greeting` from the React SDK via the typed variation
  hooks (`useBoolVariation`, `useStringVariation`).
- [`src/__tests__/Banner.test.tsx`](./src/__tests__/Banner.test.tsx) - Jest +
  `@testing-library/react` tests that drive the component through the
  `@launchdarkly/client-testing-plugin/react-sdk` wrapper.
- [`setup-jest.js`](./setup-jest.js) - a minimal jest setup that is needed to mock
  out globals that are used by the React SDK.

## Base example

```tsx
import { render, screen } from '@testing-library/react';
import { createTestClient } from '@launchdarkly/client-testing-plugin/react-sdk';
import { createLDReactProviderWithClient } from '@launchdarkly/react-sdk';

const { client, testData } = createTestClient(
  { kind: 'user', key: 'tester' },
  { 'show-banner': true, greeting: 'Welcome' },
);
await client.start({ bootstrap: {} });

const LDProvider = createLDReactProviderWithClient(client);

render(
  <LDProvider>
    <Banner />
  </LDProvider>,
);
```

`createTestClient` returns the SDK client + the `TestData` instance which could be
used to control the flagstore states.

## Updating flag values after the component has rendered

Mutate `testData` in `act(...)` to drive re-renders.

```tsx
import { act } from '@testing-library/react';

// initial render with greeting = 'Welcome'
expect(screen.getByRole('banner')).toHaveTextContent('Welcome');

await act(async () => {
  testData.setString('greeting', 'Updated greeting');
});

expect(await screen.findByText('Updated greeting')).toBeInTheDocument();
```
