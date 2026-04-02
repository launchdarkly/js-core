/**
 * @jest-environment jsdom
 *
 * Demonstrates the canonical unit-test pattern for components that consume
 * flags from `@launchdarkly/react-sdk`:
 *
 *   1. Build a `TestData` instance and seed it with flag values.
 *   2. Create a real React SDK client with `streaming: false`, `sendEvents: false`,
 *      and `plugins: [td]` so no LaunchDarkly network traffic is generated.
 *   3. Start the client with `bootstrap: {}` so initialization does not block.
 *   4. Wrap the component in a provider built from that client and assert.
 *
 * This is the pattern that replaces the deprecated `jest-launchdarkly-mock`.
 */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';

import { TestData } from '@launchdarkly/client-testing-plugin';
import { createClient, createLDReactProviderWithClient } from '@launchdarkly/react-sdk';

import { Banner } from '../Banner';

// Track every client created during a test so `afterEach` can `close()` them.
// Without this, each test leaks an LDClient (event-processor timers, internal
// listeners, etc.). For a single example that does not matter, but the
// pattern shown here is what customers should copy into real test suites.
const createdClients: Array<{ close: () => Promise<void> }> = [];

async function mountBanner(td: TestData) {
  const client = createClient(
    'test-client-id',
    { kind: 'user', key: 'tester' },
    {
      plugins: [td],
      sendEvents: false,
      streaming: false,
      diagnosticOptOut: true,
    },
  );
  createdClients.push(client);
  await client.start({ bootstrap: {} });

  const LDProvider = createLDReactProviderWithClient(client);
  const utils = render(
    <LDProvider>
      <Banner />
    </LDProvider>,
  );

  return { client, utils };
}

describe('Banner with TestData', () => {
  let td: TestData;

  beforeEach(() => {
    // A fresh TestData per test guarantees isolation: the client constructed
    // in the previous test is not reused, and no flag overrides leak across.
    td = new TestData();
  });

  afterEach(async () => {
    await Promise.all(createdClients.map((c) => c.close()));
    createdClients.length = 0;
  });

  it('shows the banner when show-banner is true', async () => {
    td.update(td.flag('show-banner').booleanFlag().variationForAll(true));
    td.update(td.flag('greeting').stringFlag('Welcome'));

    await mountBanner(td);

    expect(screen.getByRole('banner')).toHaveTextContent('Welcome');
  });

  it('hides the banner when show-banner is false', async () => {
    td.update(td.flag('show-banner').booleanFlag().variationForAll(false));
    td.update(td.flag('greeting').stringFlag('Welcome'));

    await mountBanner(td);

    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('reflects the greeting flag value in the rendered text', async () => {
    td.update(td.flag('show-banner').booleanFlag().variationForAll(true));
    td.update(td.flag('greeting').stringFlag('Howdy partner'));

    await mountBanner(td);

    expect(screen.getByRole('banner')).toHaveTextContent('Howdy partner');
  });

  it('re-renders when a flag is updated at runtime via td.update(...)', async () => {
    td.update(td.flag('show-banner').booleanFlag().variationForAll(true));
    td.update(td.flag('greeting').stringFlag('Welcome'));

    await mountBanner(td);

    expect(screen.getByRole('banner')).toHaveTextContent('Welcome');

    await act(async () => {
      td.update(td.flag('greeting').stringFlag('Updated greeting'));
    });

    expect(await screen.findByText('Updated greeting')).toBeInTheDocument();
  });

  it('isolates flag state across tests with a fresh TestData instance', async () => {
    // No overrides set on this fresh TestData, so the banner falls through to
    // its default of `false` and renders nothing - even though previous tests
    // had `show-banner` overridden to true.
    await mountBanner(td);

    expect(screen.queryByRole('banner')).toBeNull();
  });
});
