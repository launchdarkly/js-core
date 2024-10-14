import { subsystem } from '@launchdarkly/js-sdk-common';

import { LDClientImpl, LDFeatureStore } from '../src';
import TestData from '../src/integrations/test_data/TestData';
import AsyncStoreFacade from '../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../src/store/VersionedDataKinds';
import { createBasicPlatform } from './createBasicPlatform';
import TestLogger, { LogLevel } from './Logger';
import makeCallbacks from './makeCallbacks';

const defaultUser = { key: 'user' };

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let td: TestData;

  beforeEach(async () => {
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key-evaluation-test-data',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
      makeCallbacks(true),
    );

    await client.waitForInitialization({ timeout: 10 });
  });

  afterEach(() => {
    client.close();
  });

  it('evaluates a flag which has a fallthrough and a rule', async () => {
    const testId = 'abcd'.repeat(8);
    const flagKey = 'testFlag';
    await td.update(td.flag(flagKey).booleanFlag().variationForAll(true));
    await td.update(td.flag(flagKey).ifMatch('user', 'testId', testId).thenReturn(false));

    // Evaluate with no testId
    const flagsState = await client.allFlagsState({
      kind: 'user',
      key: 'fake',
      testId: undefined,
    });

    const features = flagsState.allValues();

    expect(features[flagKey]).toBeTruthy();

    const flagsStateWithTenant = await client.allFlagsState({
      kind: 'user',
      key: testId,
      testId,
    });

    const featuresWithTenant = flagsStateWithTenant.allValues();
    expect(featuresWithTenant[flagKey]).toBeFalsy();
  });

  it('evaluates an existing flag', async () => {
    td.update(td.flag('flagkey').on(true).variations('a', 'b').fallthroughVariation(1));
    expect(await client.variation('flagkey', defaultUser, 'c')).toBe('b');
  });

  it('returns default for an unknown flag', async () => {
    expect(await client.variation('flagkey', defaultUser, 'c')).toBe('c');
  });

  it('returns default if a flag key is not specified', async () => {
    // @ts-ignore
    expect(await client.variation(null, defaultUser, 'c')).toBe('c');
  });

  it('returns the default for a flag which evaluates to null', async () => {
    td.usePreconfiguredFlag({
      // TestData normally won't construct a flag with offVariation: null
      key: 'flagIsNull',
      on: false,
      offVariation: null,
    });

    expect(await client.variation('flagIsNull', defaultUser, 'default')).toEqual('default');
  });

  it('returns the default for a flag which evaluates to null using variationDetail', async () => {
    td.usePreconfiguredFlag({
      // TestData normally won't construct a flag with offVariation: null
      key: 'flagIsNull',
      on: false,
      offVariation: null,
    });

    expect(await client.variationDetail('flagIsNull', defaultUser, 'default')).toMatchObject({
      value: 'default',
      variationIndex: null,
      reason: { kind: 'OFF' },
    });
  });

  it('can use a callback instead of a promise', (done) => {
    client.variation('nonsense', defaultUser, 'default', (err, result) => {
      expect(err).toBeNull();
      expect(result).toEqual('default');
      done();
    });
  });

  it('can use a callback instead of a promise for variationDetail', (done) => {
    client.variationDetail('nonsense', defaultUser, 'default', (err, result) => {
      expect(err).toBeNull();
      expect(result).toMatchObject({
        value: 'default',
        variationIndex: null,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
      });
      done();
    });
  });

  it('can evaluate an existing flag with detail', async () => {
    td.update(td.flag('flagkey').on(true).variations('a', 'b').fallthroughVariation(1));
    expect(await client.variationDetail('flagkey', defaultUser, 'c')).toMatchObject({
      value: 'b',
      variationIndex: 1,
      reason: { kind: 'FALLTHROUGH' },
    });
  });

  it('returns default for an unknown flag with detail', async () => {
    expect(await client.variationDetail('flagkey', defaultUser, 'default')).toMatchObject({
      value: 'default',
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
    });
  });

  it('evaluates and updates user targets from test data', async () => {
    // This is a specific test case for a customer issue.
    // It tests the combination of evaluation and test data functionality.
    const userUuid = '1234';
    const userContextObject = {
      kind: 'user',
      key: userUuid,
    };

    await td.update(
      td.flag('my-feature-flag-1').variationForUser(userUuid, false).fallthroughVariation(false),
    );
    const valueA = await client.variation('my-feature-flag-1', userContextObject, 'default');
    expect(valueA).toEqual(false);

    await td.update(
      td.flag('my-feature-flag-1').variationForUser(userUuid, true).fallthroughVariation(false),
    );

    const valueB = await client.variation('my-feature-flag-1', userContextObject, 'default');
    expect(valueB).toEqual(true);
  });

  it('evaluates with jsonVariation', async () => {
    td.update(td.flag('flagkey').booleanFlag().on(true));
    const boolRes: boolean = (await client.jsonVariation('flagkey', defaultUser, false)) as boolean;
    expect(boolRes).toBe(true);

    td.update(td.flag('flagkey').valueForAll(62));
    const numericRes: number = (await client.jsonVariation(
      'flagkey',
      defaultUser,
      false,
    )) as number;
    expect(numericRes).toBe(62);

    td.update(td.flag('flagkey').valueForAll('potato'));
    const stringRes: string = (await client.jsonVariation('flagkey', defaultUser, false)) as string;
    expect(stringRes).toBe('potato');
  });

  it('evaluates an existing boolean flag', async () => {
    td.update(td.flag('flagkey').booleanFlag().on(true));
    expect(await client.boolVariation('flagkey', defaultUser, false)).toEqual(true);
  });

  it('it uses the default value when a boolean variation is for a flag of the wrong type', async () => {
    td.update(td.flag('flagkey').valueForAll('potato'));
    expect(await client.boolVariation('flagkey', defaultUser, false)).toEqual(false);
  });

  it('evaluates an existing numeric flag', async () => {
    td.update(td.flag('flagkey').booleanFlag().valueForAll(18));
    expect(await client.numberVariation('flagkey', defaultUser, 36)).toEqual(18);
  });

  it('it uses the default value when a numeric variation is for a flag of the wrong type', async () => {
    td.update(td.flag('flagkey').valueForAll('potato'));
    expect(await client.numberVariation('flagkey', defaultUser, 36)).toEqual(36);
  });

  it('evaluates an existing string flag', async () => {
    td.update(td.flag('flagkey').booleanFlag().valueForAll('potato'));
    expect(await client.stringVariation('flagkey', defaultUser, 'default')).toEqual('potato');
  });

  it('it uses the default value when a string variation is for a flag of the wrong type', async () => {
    td.update(td.flag('flagkey').valueForAll(8));
    expect(await client.stringVariation('flagkey', defaultUser, 'default')).toEqual('default');
  });

  it('evaluates an existing boolean flag with detail', async () => {
    td.update(td.flag('flagkey').booleanFlag().on(true));
    const res = await client.boolVariationDetail('flagkey', defaultUser, false);
    expect(res.value).toEqual(true);
    expect(res.reason.kind).toBe('FALLTHROUGH');
  });

  it('it uses the default value when a boolean variation is for a flag of the wrong type with detail', async () => {
    td.update(td.flag('flagkey').valueForAll('potato'));
    const res = await client.boolVariationDetail('flagkey', defaultUser, false);
    expect(res.value).toEqual(false);
    expect(res.reason.kind).toEqual('ERROR');
    expect(res.reason.errorKind).toEqual('WRONG_TYPE');
  });

  it('evaluates an existing numeric flag with detail', async () => {
    td.update(td.flag('flagkey').booleanFlag().valueForAll(18));
    const res = await client.numberVariationDetail('flagkey', defaultUser, 36);
    expect(res.value).toEqual(18);
    expect(res.reason.kind).toBe('FALLTHROUGH');
  });

  it('it uses the default value when a numeric variation is for a flag of the wrong type with detail', async () => {
    td.update(td.flag('flagkey').valueForAll('potato'));
    const res = await client.numberVariationDetail('flagkey', defaultUser, 36);
    expect(res.value).toEqual(36);
    expect(res.reason.kind).toEqual('ERROR');
    expect(res.reason.errorKind).toEqual('WRONG_TYPE');
  });

  it('evaluates an existing string flag with detail', async () => {
    td.update(td.flag('flagkey').booleanFlag().valueForAll('potato'));
    const res = await client.stringVariationDetail('flagkey', defaultUser, 'default');
    expect(res.value).toEqual('potato');
    expect(res.reason.kind).toBe('FALLTHROUGH');
  });

  it('it uses the default value when a string variation is for a flag of the wrong type with detail', async () => {
    td.update(td.flag('flagkey').valueForAll(8));
    const res = await client.stringVariationDetail('flagkey', defaultUser, 'default');
    expect(res.value).toEqual('default');
    expect(res.reason.kind).toEqual('ERROR');
    expect(res.reason.errorKind).toEqual('WRONG_TYPE');
  });
});

describe('given an offline client', () => {
  let logger: TestLogger;
  let client: LDClientImpl;
  let td: TestData;

  beforeEach(() => {
    logger = new TestLogger();
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key-evaluation-offline',
      createBasicPlatform(),
      {
        offline: true,
        updateProcessor: td.getFactory(),
        sendEvents: false,
        logger,
      },
      makeCallbacks(true),
    );
  });

  afterEach(() => {
    client.close();
  });

  it('returns the default value for variation', async () => {
    await client.waitForInitialization({ timeout: 10 });
    td.update(td.flag('flagkey').variations('value').variationForAll(0));
    const result = await client.variation('flagkey', defaultUser, 'default');
    expect(result).toEqual('default');
    expect(logger.getCount(LogLevel.Info)).toEqual(1);
  });

  it('returns the default value for variationDetail', async () => {
    await client.waitForInitialization({ timeout: 10 });
    td.update(td.flag('flagkey').variations('value').variationForAll(0));
    const result = await client.variationDetail('flagkey', defaultUser, 'default');
    expect(result).toMatchObject({
      value: 'default',
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' },
    });
    expect(logger.getCount(LogLevel.Info)).toEqual(1);
  });
});

class InertUpdateProcessor implements subsystem.LDStreamProcessor {
  start(_fn?: ((err?: any) => void) | undefined) {
    // Never initialize.
  }

  stop() {}

  close() {}
}

describe('given a client and store that are uninitialized', () => {
  let store: LDFeatureStore;
  let client: LDClientImpl;

  beforeEach(async () => {
    store = new InMemoryFeatureStore();
    const asyncStore = new AsyncStoreFacade(store);
    // Put something in the store, but don't initialize it.
    await asyncStore.upsert(VersionedDataKinds.Features, {
      key: 'flagkey',
      version: 1,
      on: false,
      offVariation: 0,
      variations: ['value'],
    });

    client = new LDClientImpl(
      'sdk-key-evaluation-uninitialized-store',
      createBasicPlatform(),
      {
        updateProcessor: new InertUpdateProcessor(),
        sendEvents: false,
        featureStore: store,
      },
      makeCallbacks(true),
    );
  });

  afterEach(() => {
    client.close();
  });

  it('returns the default value for variation', async () => {
    expect(await client.variation('flagkey', defaultUser, 'default')).toEqual('default');
  });

  it('returns the default value for variationDetail', async () => {
    expect(await client.variationDetail('flagkey', defaultUser, 'default')).toMatchObject({
      value: 'default',
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' },
    });
  });
});

describe('given a client that is un-initialized and store that is initialized', () => {
  let store: LDFeatureStore;
  let client: LDClientImpl;

  beforeEach(async () => {
    store = new InMemoryFeatureStore();
    const asyncStore = new AsyncStoreFacade(store);
    // Put something in the store, but don't initialize it.
    await asyncStore.init({
      features: {
        flagkey: {
          version: 1,
          on: false,
          offVariation: 0,
          variations: ['value'],
        },
      },
      segments: {},
    });

    client = new LDClientImpl(
      'sdk-key-initialized-store',
      createBasicPlatform(),
      {
        sendEvents: false,
        featureStore: store,
        updateProcessor: () => ({
          start: jest.fn(),
          stop: jest.fn(),
          close: jest.fn(),
        }),
      },
      makeCallbacks(true),
    );
  });

  afterEach(() => {
    client.close();
  });

  it('returns the value for variation', async () => {
    expect(await client.variation('flagkey', defaultUser, 'default')).toEqual('value');
  });

  it('returns the value for variationDetail', async () => {
    expect(await client.variationDetail('flagkey', defaultUser, 'default')).toMatchObject({
      value: 'value',
      variationIndex: 0,
      reason: { kind: 'OFF' },
    });
  });
});
