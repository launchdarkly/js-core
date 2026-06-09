/**
 * @jest-environment jsdom
 *
 * Demonstrates the canonical unit-test pattern for components that consume
 * flags from `@launchdarkly/react-sdk`.
 *
 * Two helpers are available from `@launchdarkly/client-testing-plugin/react-sdk`:
 *
 * - `createTestClientProvider(context, initialFlags)` - the ergonomic shorthand.
 *   Returns `{ Provider, client, testData }` with the client already started.
 *   Use this for most tests.
 *
 * - `createTestClient(context, initialFlags)` - the lower-level form.
 *   Returns `{ client, testData }` without starting the client. Use this when
 *   you need to configure the client further before calling `client.start()`,
 *   or when you need to call `createLDReactProviderWithClient` yourself.
 */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';

import { createTestClient, createTestClientProvider } from '@launchdarkly/client-testing-plugin/react-sdk';
import { createLDReactProviderWithClient } from '@launchdarkly/react-sdk';

import { Banner } from '../Banner';

// -- createTestClientProvider --------------------------------------------------
//
// `createTestClientProvider` starts the client automatically and returns a
// pre-wired Provider. This is the recommended form for most tests.

it('createTestClientProvider: shows the banner when show-banner is true', async () => {
  const { Provider, client } = await createTestClientProvider(
    { kind: 'user', key: 'tester' },
    { 'show-banner': true, greeting: 'Welcome' },
    { diagnosticOptOut: true },
  );

  render(
    <Provider>
      <Banner />
    </Provider>,
  );

  expect(screen.getByRole('banner')).toHaveTextContent('Welcome');
  await client.close();
});

it('createTestClientProvider: hides the banner when show-banner is false', async () => {
  const { Provider, client } = await createTestClientProvider(
    { kind: 'user', key: 'tester' },
    { 'show-banner': false },
    { diagnosticOptOut: true },
  );

  render(
    <Provider>
      <Banner />
    </Provider>,
  );

  expect(screen.queryByRole('banner')).toBeNull();
  await client.close();
});

it('createTestClientProvider: re-renders when a flag is updated at runtime via testData', async () => {
  const { Provider, client, testData } = await createTestClientProvider(
    { kind: 'user', key: 'tester' },
    { 'show-banner': true, greeting: 'Welcome' },
    { diagnosticOptOut: true },
  );

  render(
    <Provider>
      <Banner />
    </Provider>,
  );

  expect(screen.getByRole('banner')).toHaveTextContent('Welcome');

  await act(async () => {
    testData.setString('greeting', 'Updated greeting');
  });

  expect(await screen.findByText('Updated greeting')).toBeInTheDocument();
  await client.close();
});

it('createTestClientProvider: isolates flag state across tests with a fresh TestData instance', async () => {
  // No initial flags -- banner falls through to its default of `false` and
  // renders nothing, even though a previous test had `show-banner` set to true.
  const { Provider, client } = await createTestClientProvider(
    { kind: 'user', key: 'tester' },
    undefined,
    { diagnosticOptOut: true },
  );

  render(
    <Provider>
      <Banner />
    </Provider>,
  );

  expect(screen.queryByRole('banner')).toBeNull();
  await client.close();
});

// -- createTestClient ----------------------------------------------------------
//
// `createTestClient` returns the client without starting it. Use this when you
// need to call `createLDReactProviderWithClient` yourself or configure the
// client before starting.

it('createTestClient: shows the banner when show-banner is true', async () => {
  const { client } = createTestClient(
    { kind: 'user', key: 'tester' },
    { 'show-banner': true, greeting: 'Welcome' },
    { diagnosticOptOut: true },
  );
  await client.start({ bootstrap: {} });

  const LDProvider = createLDReactProviderWithClient(client);
  render(
    <LDProvider>
      <Banner />
    </LDProvider>,
  );

  expect(screen.getByRole('banner')).toHaveTextContent('Welcome');
  await client.close();
});

it('createTestClient: re-renders when a flag is updated at runtime via testData', async () => {
  const { client, testData } = createTestClient(
    { kind: 'user', key: 'tester' },
    { 'show-banner': true, greeting: 'Welcome' },
    { diagnosticOptOut: true },
  );
  await client.start({ bootstrap: {} });

  const LDProvider = createLDReactProviderWithClient(client);
  render(
    <LDProvider>
      <Banner />
    </LDProvider>,
  );

  expect(screen.getByRole('banner')).toHaveTextContent('Welcome');

  await act(async () => {
    testData.setString('greeting', 'Updated greeting');
  });

  expect(await screen.findByText('Updated greeting')).toBeInTheDocument();
  await client.close();
});
