import { LDClientImpl } from '../src';
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
  let logger: TestLogger;

  beforeEach(async () => {
    logger = new TestLogger();
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key-all-flags-test-data',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        logger,
      },
      makeCallbacks(true),
    );

    await client.waitForInitialization({ timeout: 10 });
  });

  afterEach(() => {
    client.close();
  });

  it('captures flag state', async () => {
    const value1 = 'value1';
    const value2 = 'value2';
    const value3 = 'value3';
    const flag1 = {
      key: 'key1',
      version: 100,
      on: false,
      offVariation: 0,
      variations: [value1],
    };
    const flag2 = {
      key: 'key2',
      version: 200,
      on: false,
      offVariation: 1,
      variations: ['x', value2],
      trackEvents: true,
      debugEventsUntilDate: 1000,
    };
    // flag3 has an experiment (evaluation is a fallthrough and TrackEventsFallthrough is on)
    const flag3 = {
      key: 'key3',
      version: 300,
      on: true,
      fallthrough: { variation: 1 },
      variations: ['x', value3],
      trackEvents: false,
      trackEventsFallthrough: true,
    };
    td.usePreconfiguredFlag(flag1);
    td.usePreconfiguredFlag(flag2);
    td.usePreconfiguredFlag(flag3);

    const state = await client.allFlagsState(defaultUser);
    expect(state.valid).toEqual(true);
    expect(state.allValues()).toEqual({
      [flag1.key]: value1,
      [flag2.key]: value2,
      [flag3.key]: value3,
    });
    expect(state.getFlagValue(flag1.key)).toEqual(value1);
    expect(state.getFlagReason('feature')).toEqual(null);
    expect(state.toJSON()).toEqual({
      [flag1.key]: value1,
      [flag2.key]: value2,
      [flag3.key]: value3,
      $flagsState: {
        [flag1.key]: {
          version: flag1.version,
          variation: 0,
        },
        [flag2.key]: {
          version: flag2.version,
          variation: 1,
          trackEvents: true,
          debugEventsUntilDate: 1000,
        },
        [flag3.key]: {
          version: flag3.version,
          variation: 1,
          reason: { kind: 'FALLTHROUGH' },
          trackEvents: true,
          trackReason: true,
        },
      },
      $valid: true,
    });
  });

  it('can filter for only client-side flags', async () => {
    td.usePreconfiguredFlag({
      key: 'server-side-1',
      on: false,
      offVariation: 0,
      variations: ['a'],
    });
    td.usePreconfiguredFlag({
      key: 'server-side-2',
      on: false,
      offVariation: 0,
      variations: ['b'],
      // Absence and false should be equivalent, so we add a false one here.
      clientSideAvailability: { usingEnvironmentId: false },
    });
    td.usePreconfiguredFlag({
      key: 'client-side-1',
      on: false,
      offVariation: 0,
      variations: ['value1'],
      clientSideAvailability: { usingEnvironmentId: true },
    });
    td.usePreconfiguredFlag({
      key: 'client-side-2',
      on: false,
      offVariation: 0,
      variations: ['value2'],
      clientSideAvailability: { usingEnvironmentId: true },
    });
    const state = await client.allFlagsState(defaultUser, { clientSideOnly: true });
    expect(state.valid).toEqual(true);
    expect(state.allValues()).toEqual({ 'client-side-1': 'value1', 'client-side-2': 'value2' });
  });

  it('can include reasons', async () => {
    td.usePreconfiguredFlag({
      key: 'feature',
      version: 100,
      offVariation: 1,
      variations: ['a', 'b'],
      trackEvents: true,
      debugEventsUntilDate: 1000,
    });
    const state = await client.allFlagsState(defaultUser, { withReasons: true });
    expect(state.valid).toEqual(true);
    expect(state.allValues()).toEqual({ feature: 'b' });
    expect(state.getFlagValue('feature')).toEqual('b');
    expect(state.getFlagReason('feature')).toEqual({ kind: 'OFF' });
    expect(state.toJSON()).toEqual({
      feature: 'b',
      $flagsState: {
        feature: {
          version: 100,
          variation: 1,
          reason: { kind: 'OFF' },
          trackEvents: true,
          debugEventsUntilDate: 1000,
        },
      },
      $valid: true,
    });
  });

  it('can omit details for untracked flags', async () => {
    const flag1 = {
      key: 'flag1',
      version: 100,
      offVariation: 0,
      variations: ['value1'],
    };
    const flag2 = {
      key: 'flag2',
      version: 200,
      offVariation: 0,
      variations: ['value2'],
      trackEvents: true,
    };
    const flag3 = {
      key: 'flag3',
      version: 300,
      offVariation: 0,
      variations: ['value3'],
      debugEventsUntilDate: 1000,
    };
    td.usePreconfiguredFlag(flag1);
    td.usePreconfiguredFlag(flag2);
    td.usePreconfiguredFlag(flag3);

    const state = await client.allFlagsState(defaultUser, {
      withReasons: true,
      detailsOnlyForTrackedFlags: true,
    });
    expect(state.valid).toEqual(true);
    expect(state.allValues()).toEqual({ flag1: 'value1', flag2: 'value2', flag3: 'value3' });
    expect(state.getFlagValue('flag1')).toEqual('value1');
    expect(state.toJSON()).toEqual({
      flag1: 'value1',
      flag2: 'value2',
      flag3: 'value3',
      $flagsState: {
        flag1: {
          variation: 0,
        },
        flag2: {
          version: 200,
          variation: 0,
          reason: { kind: 'OFF' },
          trackEvents: true,
        },
        flag3: {
          version: 300,
          variation: 0,
          reason: { kind: 'OFF' },
          debugEventsUntilDate: 1000,
        },
      },
      $valid: true,
    });
  });

  it('does not overflow the call stack when evaluating a huge number of flags', async () => {
    const flagCount = 5000;
    for (let i = 0; i < flagCount; i += 1) {
      td.usePreconfiguredFlag({
        key: `feature${i}`,
        version: 1,
        on: false,
      });
    }
    const state = await client.allFlagsState(defaultUser);
    expect(Object.keys(state.allValues()).length).toEqual(flagCount);
  });

  it('can use callback instead of promise', (done) => {
    td.usePreconfiguredFlag({
      key: 'server-side-1',
      on: false,
      offVariation: 0,
      variations: ['a'],
    });
    td.usePreconfiguredFlag({
      key: 'server-side-2',
      on: false,
      offVariation: 0,
      variations: ['b'],
    });
    td.usePreconfiguredFlag({
      key: 'client-side-1',
      on: false,
      offVariation: 0,
      variations: ['value1'],
      clientSideAvailability: { usingEnvironmentId: true },
    });
    td.usePreconfiguredFlag({
      key: 'client-side-2',
      on: false,
      offVariation: 0,
      variations: ['value2'],
      clientSideAvailability: { usingEnvironmentId: true },
    });
    client.allFlagsState(defaultUser, { clientSideOnly: true }, (err, state) => {
      expect(state.valid).toEqual(true);
      expect(state.allValues()).toEqual({ 'client-side-1': 'value1', 'client-side-2': 'value2' });
      done();
    });
  });

  it('includes prerequisites in flag meta', async () => {
    await td.update(td.flag('is-prereq').valueForAll(true));
    await td.usePreconfiguredFlag({
      key: 'has-prereq-depth-1',
      on: true,
      prerequisites: [
        {
          key: 'is-prereq',
          variation: 0,
        },
      ],
      fallthrough: {
        variation: 0,
      },
      offVariation: 1,
      variations: [true, false],
      clientSideAvailability: {
        usingMobileKey: true,
        usingEnvironmentId: true,
      },
      clientSide: true,
      version: 4,
    });

    const state = await client.allFlagsState(defaultUser, {
      withReasons: true,
      detailsOnlyForTrackedFlags: false,
    });
    expect(state.valid).toEqual(true);
    expect(state.allValues()).toEqual({ 'is-prereq': true, 'has-prereq-depth-1': true });
    expect(state.toJSON()).toEqual({
      'is-prereq': true,
      'has-prereq-depth-1': true,
      $flagsState: {
        'is-prereq': {
          variation: 0,
          reason: {
            kind: 'FALLTHROUGH',
          },
          version: 1,
        },
        'has-prereq-depth-1': {
          variation: 0,
          prerequisites: ['is-prereq'],
          reason: {
            kind: 'FALLTHROUGH',
          },
          version: 4,
        },
      },
      $valid: true,
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
      'sdk-key-all-flags-offline',
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

  it('returns empty state in offline mode and logs a message', async () => {
    const flag = {
      key: 'flagkey',
      on: false,
      offVariation: null,
    };
    td.usePreconfiguredFlag(flag);
    const state = await client.allFlagsState(defaultUser);
    expect(state.valid).toEqual(false);
    expect(state.allValues()).toEqual({});
    expect(logger.getCount(LogLevel.Info)).toEqual(1);
  });

  it('can use a callback instead of a Promise', (done) => {
    client.allFlagsState(defaultUser, {}, (err, state) => {
      expect(state.valid).toEqual(false);
      done();
    });
  });
});

describe('given an LDClient with a flag the evaluator cannot read', () => {
  let client: LDClientImpl;
  let td: TestData;
  let onError: jest.Mock;

  beforeEach(async () => {
    td = new TestData();
    onError = jest.fn();
    client = new LDClientImpl(
      'sdk-key-all-flags-malformed',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
      { ...makeCallbacks(true), onError },
    );

    await client.waitForInitialization({ timeout: 10 });
    // LaunchDarkly never sends a flag without variations, but a custom store or a data file
    // can. A healthy flag sits next to it to show the rest of the state is still built.
    await td.usePreconfiguredFlag({
      key: 'malformed',
      version: 1,
      on: true,
      fallthrough: { variation: 0 },
    });
    await td.usePreconfiguredFlag({
      key: 'healthy',
      version: 1,
      on: false,
      offVariation: 0,
      variations: ['a'],
    });
  });

  afterEach(() => {
    client.close();
  });

  it('resolves allFlagsState, reports the flag through the error callback, and keeps the rest', async () => {
    const state = await client.allFlagsState(defaultUser, { withReasons: true });

    expect(state.valid).toBe(true);
    expect(state.getFlagValue('healthy')).toBe('a');
    expect(state.getFlagValue('malformed')).toBeNull();
    expect(state.getFlagReason('malformed')).toEqual({
      kind: 'ERROR',
      errorKind: 'MALFORMED_FLAG',
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(
      /^Error for feature flag "malformed" while evaluating all flags: /,
    );
  });
});

describe('given an LDClient whose store holds an item that fails after evaluation', () => {
  let client: LDClientImpl;
  let onError: jest.Mock;

  beforeEach(async () => {
    const store = new InMemoryFeatureStore();
    const td = new TestData();
    onError = jest.fn();
    client = new LDClientImpl(
      'sdk-key-all-flags-unreadable',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        featureStore: store,
      },
      { ...makeCallbacks(true), onError },
    );
    await client.waitForInitialization({ timeout: 10 });

    // The evaluator turns a definition it cannot read into an error result, which allFlagsState
    // handles like any other error. This item evaluates cleanly and then throws when its event
    // settings are read while the state is assembled, which stands in for any unexpected
    // failure outside of evaluation. Before the error path existed, the promise never settled.
    const unreadable = new Proxy(
      { key: 'unreadable', version: 1, on: false, offVariation: 0, variations: ['a'] },
      {
        get(target, property) {
          if (property === 'trackEvents') {
            throw new Error('unreadable item');
          }
          return target[property as keyof typeof target];
        },
      },
    );
    // The store keeps the object handed to init, while upsert copies it and would drop the trap.
    await new AsyncStoreFacade(store).init({
      [VersionedDataKinds.Features.namespace]: { unreadable },
      [VersionedDataKinds.Segments.namespace]: {},
    });
  });

  afterEach(() => {
    client.close();
  });

  it('reports the failure through the error callback and resolves with an invalid state', async () => {
    const state = await client.allFlagsState(defaultUser);

    expect(state.valid).toBe(false);
    expect(state.allValues()).toEqual({});
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('unreadable item');
  });

  it('delivers the invalid state to a callback', (done) => {
    client.allFlagsState(defaultUser, {}, (err, state) => {
      expect(err).toBeNull();
      expect(state.valid).toBe(false);
      done();
    });
  });
});
