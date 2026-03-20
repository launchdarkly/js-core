import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { createLDServerWrapper } from '../../src/server/LDServerSession';
import { makeMockServerClient } from './mockServerClient';

const context: LDContext = { kind: 'user', key: 'test-user' };

it('calls track once after the first variation call', async () => {
  const client = makeMockServerClient();
  const session = createLDServerWrapper(client, context);

  await session.boolVariation('flag-1', false);

  expect(client.track).toHaveBeenCalledTimes(1);
  expect(client.track).toHaveBeenCalledWith('$ld:react-sdk:rsc-evaluation', context);
});

it('does not call track again on subsequent variation calls', async () => {
  const client = makeMockServerClient();
  const session = createLDServerWrapper(client, context);

  await session.boolVariation('flag-1', false);
  await session.stringVariation('flag-2', 'default');
  await session.numberVariation('flag-3', 0);
  await session.jsonVariation('flag-4', {});
  await session.boolVariationDetail('flag-5', false);
  await session.numberVariationDetail('flag-6', 0);
  await session.stringVariationDetail('flag-7', 'default');
  await session.jsonVariationDetail('flag-8', {});

  expect(client.track).toHaveBeenCalledTimes(1);
});

it('does not call track if no variation calls are made', () => {
  const client = makeMockServerClient();
  createLDServerWrapper(client, context);

  expect(client.track).not.toHaveBeenCalled();
});

it('does not call track for allFlagsState', async () => {
  const client = makeMockServerClient();
  const session = createLDServerWrapper(client, context);

  await session.allFlagsState();

  expect(client.track).not.toHaveBeenCalled();
});

it('does not call track for initialized', () => {
  const client = makeMockServerClient();
  const session = createLDServerWrapper(client, context);

  session.initialized();

  expect(client.track).not.toHaveBeenCalled();
});
