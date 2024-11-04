import { LDClientImpl, LDMigrationStage } from '../src';
import Reasons from '../src/evaluation/Reasons';
import TestData from '../src/integrations/test_data/TestData';
import { createBasicPlatform } from './createBasicPlatform';
import { TestHook } from './hooks/TestHook';
import TestLogger from './Logger';
import makeCallbacks from './makeCallbacks';

const defaultUser = { kind: 'user', key: 'user-key' };

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let td: TestData;
  let testHook: TestHook;
  let logger: TestLogger;

  beforeEach(async () => {
    logger = new TestLogger();
    testHook = new TestHook();
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key-hooks-test-data',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        hooks: [testHook],
        logger,
      },
      makeCallbacks(true),
    );

    await client.waitForInitialization({ timeout: 10 });
  });

  afterEach(() => {
    client.close();
  });

  it('variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.variation('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variation',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.variationDetail('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variationDetail',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('boolean variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.boolVariation('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariation',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('boolean variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.boolVariationDetail('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariationDetail',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('number variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll(42).on(true));
    await client.numberVariation('flagKey', defaultUser, 21);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariation',
      },
      {},
      {
        value: 42,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('number variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll(42).on(true));
    await client.numberVariationDetail('flagKey', defaultUser, 21);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariationDetail',
      },
      {},
      {
        value: 42,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('string variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll('strValue').on(true));
    await client.stringVariation('flagKey', defaultUser, 'default');
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariation',
      },
      {},
      {
        value: 'strValue',
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('string variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll('strValue').on(true));
    await client.stringVariationDetail('flagKey', defaultUser, 'default');
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariationDetail',
      },
      {},
      {
        value: 'strValue',
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('json variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll({ the: 'value' }).on(true));
    await client.jsonVariation('flagKey', defaultUser, { default: 'value' });
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariation',
      },
      {},
      {
        value: { the: 'value' },
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('json variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll({ the: 'value' }).on(true));
    await client.jsonVariationDetail('flagKey', defaultUser, { default: 'value' });
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariationDetail',
      },
      {},
      {
        value: { the: 'value' },
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('migration variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll('live'));
    await client.migrationVariation('flagKey', defaultUser, LDMigrationStage.Off);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'off',
        method: 'LDClient.migrationVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'off',
        method: 'LDClient.migrationVariation',
      },
      {},
      {
        value: 'live',
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });
});

it('can add a hook after initialization', async () => {
  const logger = new TestLogger();
  const td = new TestData();
  const client = new LDClientImpl(
    'sdk-key-hook-after-init',
    createBasicPlatform(),
    {
      updateProcessor: td.getFactory(),
      sendEvents: false,
      logger,
    },
    makeCallbacks(true),
  );

  await client.waitForInitialization({ timeout: 10 });

  td.update(td.flag('flagKey').booleanFlag().on(true));
  const testHook = new TestHook();
  client.addHook(testHook);

  await client.variation('flagKey', defaultUser, false);
  testHook.verifyBefore(
    {
      flagKey: 'flagKey',
      context: { ...defaultUser },
      defaultValue: false,
      method: 'LDClient.variation',
    },
    {},
  );
  testHook.verifyAfter(
    {
      flagKey: 'flagKey',
      context: { ...defaultUser },
      defaultValue: false,
      method: 'LDClient.variation',
    },
    {},
    {
      value: true,
      reason: Reasons.Fallthrough,
      variationIndex: 0,
    },
  );
});
