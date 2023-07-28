import { LDClientImpl } from '../src';
import { LDFeatureStore, LDStreamProcessor } from '../src/api/subsystems';
import NullUpdateProcessor from '../src/data_sources/NullUpdateProcessor';
import TestData from '../src/integrations/test_data/TestData';
import AsyncStoreFacade from '../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../src/store/VersionedDataKinds';
import basicPlatform from './evaluation/mocks/platform';
import TestLogger, { LogLevel } from './Logger';
import makeCallbacks from './makeCallbacks';

const defaultUser = { key: 'user' };

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let td: TestData;

  beforeEach(async () => {
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
      makeCallbacks(true),
    );

    await client.waitForInitialization();
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
});

describe('given an offline client', () => {
  let logger: TestLogger;
  let client: LDClientImpl;
  let td: TestData;

  beforeEach(() => {
    logger = new TestLogger();
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
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
    await client.waitForInitialization();
    td.update(td.flag('flagkey').variations('value').variationForAll(0));
    const result = await client.variation('flagkey', defaultUser, 'default');
    expect(result).toEqual('default');
    expect(logger.getCount(LogLevel.Info)).toEqual(1);
  });

  it('returns the default value for variationDetail', async () => {
    await client.waitForInitialization();
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

class InertUpdateProcessor implements LDStreamProcessor {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  start(fn?: ((err?: any) => void) | undefined) {
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
      'sdk-key',
      basicPlatform,
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
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: new NullUpdateProcessor(),
        sendEvents: false,
        featureStore: store,
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
