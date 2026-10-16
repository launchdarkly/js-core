import { LDClientContext, sleep } from '@launchdarkly/js-sdk-common';

import { LDMigrationStage } from '../src/api/data/LDMigrationStage';
import { LDFeatureStore, LDOverrideSink } from '../src/api/subsystems';
import LDClientImpl from '../src/LDClientImpl';
import InMemoryFeatureStore from '../src/store/InMemoryFeatureStore';
import { createBasicPlatform } from './createBasicPlatform';
import { TestHook } from './hooks/TestHook';
import makeMockLogger, { MockLogger } from './mockLogger';
import {
  fdv2FullPayload,
  makeCallbacks,
  makeFDv2Client,
  makeFDv2Platform,
  singleValueFlag,
} from './overrides/overridesTestSupport';
import TestOverrideSource from './overrides/TestOverrideSource';
import waitFor from './waitFor';

const user = { key: 'user-key' };

function warningsMatching(logger: { warn: jest.Mock }, pattern: RegExp): number {
  return logger.warn.mock.calls.filter((call) => pattern.test(String(call[0]))).length;
}

// Change notifications and asynchronous starts complete on later turns of the event loop.
const settle = () => sleep(10);

describe('given an uninitialized client with an override source', () => {
  let source: TestOverrideSource;
  let client: LDClientImpl;
  let logger: MockLogger;

  beforeEach(() => {
    logger = makeMockLogger();
    source = new TestOverrideSource({ flags: [singleValueFlag('overridden-flag', true)] });
    client = makeFDv2Client(makeFDv2Platform(), { logger, dataSystem: { overrides: source } });
  });

  afterEach(() => {
    client.close();
  });

  it('serves an override before the client is initialized', async () => {
    expect(client.initialized()).toBe(false);

    const detail = await client.boolVariationDetail('overridden-flag', user, false);

    expect(detail.value).toBe(true);
    expect(detail.variationIndex).toEqual(0);
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
    expect(client.initialized()).toBe(false);
  });

  it('returns the not-ready default for a flag the override layer does not hold', async () => {
    const detail = await client.boolVariationDetail('other-flag', user, false);

    expect(detail.value).toBe(false);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });
  });

  it('restores the not-ready short-circuit when the override is removed', async () => {
    expect(await client.boolVariation('overridden-flag', user, false)).toBe(true);

    source.setOverrides([]);

    const detail = await client.boolVariationDetail('overridden-flag', user, false);
    expect(detail.value).toBe(false);
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });
  });

  it('keeps a wrong type result of an overridden flag marked', async () => {
    source.setOverrides([singleValueFlag('overridden-flag', 'not-a-bool')]);

    const detail = await client.boolVariationDetail('overridden-flag', user, false);

    expect(detail.value).toBe(false);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toEqual({
      kind: 'ERROR',
      errorKind: 'WRONG_TYPE',
      overrideAffected: true,
    });
  });

  it('keeps a migration stage mismatch of an overridden flag marked', async () => {
    // The migration variation replaces the reason when the value is not a stage. The replacement
    // keeps the override-affected marking, like the typed variation methods do.
    client.close();
    const hook = new TestHook();
    client = makeFDv2Client(makeFDv2Platform(), {
      logger,
      hooks: [hook],
      dataSystem: { overrides: source },
    });
    source.setOverrides([singleValueFlag('overridden-flag', 'not-a-stage')]);

    const migration = await client.migrationVariation(
      'overridden-flag',
      user,
      LDMigrationStage.Off,
    );

    expect(migration.value).toBe(LDMigrationStage.Off);
    const after = hook.captureAfter.find(
      (capture) => capture.hookContext.method === 'LDClient.migrationVariation',
    );
    expect(after?.detail?.reason).toEqual({
      kind: 'ERROR',
      errorKind: 'WRONG_TYPE',
      overrideAffected: true,
    });
  });

  it('reports only the override layer in the all flags state and warns once', async () => {
    const state = await client.allFlagsState(user, { withReasons: true });

    expect(state.valid).toBe(true);
    expect(state.allValues()).toEqual({ 'overridden-flag': true });
    expect(state.getFlagReason('overridden-flag')).toEqual({
      kind: 'FALLTHROUGH',
      overrideAffected: true,
    });

    await client.allFlagsState(user);
    expect(warningsMatching(logger, /returning only flags from the override layer/)).toEqual(1);
  });

  it('reports an invalid empty all flags state when the override layer holds only segments', async () => {
    source.setOverrides([], [{ key: 'segment1', version: 1 }]);

    const state = await client.allFlagsState(user);

    // A layer without flags gives the state nothing to report, so the state is the one reported
    // when no data is available.
    expect(state.valid).toBe(false);
    expect(state.allValues()).toEqual({});
    expect(warningsMatching(logger, /Data store not available/)).toEqual(1);
    expect(warningsMatching(logger, /returning only flags from the override layer/)).toEqual(0);
  });

  it('reports an invalid empty all flags state when the override layer is empty', async () => {
    source.setOverrides([]);

    const state = await client.allFlagsState(user);

    expect(state.valid).toBe(false);
    expect(state.allValues()).toEqual({});
    expect(warningsMatching(logger, /Data store not available/)).toEqual(1);
  });

  it('does not become initialized because of overrides', async () => {
    await expect(client.waitForInitialization({ timeout: 0.05 })).rejects.toThrow(/timed out/);
    expect(client.initialized()).toBe(false);
  });

  it('keeps serving the previous overrides when a snapshot has a malformed definition', async () => {
    // One definition of the wrong shape fails the whole snapshot. The source's call throws with
    // the reason, and the layer keeps the earlier snapshot, so the flag it held keeps its earlier
    // value and the valid new entry of the rejected snapshot is not served.
    const withoutVariations = {
      key: 'other-flag',
      version: 1,
      on: true,
      fallthrough: { variation: 0 },
    };
    expect(() =>
      source.setOverrides([singleValueFlag('overridden-flag', false), withoutVariations]),
    ).toThrow('flag "other-flag": "variations" must be an array');

    expect(await client.boolVariation('overridden-flag', user, false)).toBe(true);
    const detail = await client.boolVariationDetail('other-flag', user, false);
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });
  });
});

describe('given an initialized client with LaunchDarkly data and an override source', () => {
  const debugUntil = Date.now() + 100000;
  const plainTracked = {
    ...singleValueFlag('plain-tracked', true, 1),
    trackEvents: true,
    debugEventsUntilDate: debugUntil,
  };
  // The overridden flag is on and serves variation 0, so the dependent flag's prerequisite
  // passes only through the override. The LaunchDarkly definition is off.
  const dependentTracked = {
    key: 'dependent-tracked',
    version: 1,
    on: true,
    variations: [false, true],
    fallthrough: { variation: 1 },
    offVariation: 0,
    prerequisites: [{ key: 'overridden-flag', variation: 0 }],
    trackEvents: true,
    debugEventsUntilDate: debugUntil,
  };
  const launchDarklyOverridden = singleValueFlag('overridden-flag', 'ld-value', 5);
  const overriddenTracked = {
    key: 'overridden-flag',
    version: 7,
    on: true,
    fallthrough: { variation: 0 },
    offVariation: 0,
    variations: [true],
    trackEvents: true,
    debugEventsUntilDate: debugUntil,
  };
  const normal = singleValueFlag('flag-normal', 'normal-value', 100);

  let source: TestOverrideSource;
  let client: LDClientImpl;

  beforeEach(async () => {
    const platform = makeFDv2Platform(
      fdv2FullPayload({
        'plain-tracked': plainTracked,
        'dependent-tracked': dependentTracked,
        'overridden-flag': launchDarklyOverridden,
        'flag-normal': normal,
      }),
    );
    source = new TestOverrideSource({ flags: [overriddenTracked] });
    client = makeFDv2Client(platform, { dataSystem: { overrides: source } });
    await client.waitForInitialization({ timeout: 5 });
  });

  afterEach(() => {
    client.close();
  });

  it('gives an override precedence over LaunchDarkly data for the same key', async () => {
    const detail = await client.variationDetail('overridden-flag', user, 'default');

    expect(detail.value).toBe(true);
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
  });

  it('leaves a flag absent from the override layer unaffected', async () => {
    const detail = await client.variationDetail('flag-normal', user, 'default');

    expect(detail.value).toEqual('normal-value');
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH' });
  });

  it('marks a flag whose prerequisite is overridden', async () => {
    const detail = await client.variationDetail('dependent-tracked', user, 'default');

    expect(detail.value).toBe(true);
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
  });

  it('turns off event tracking for override-affected flags in the all flags state', async () => {
    const state = await client.allFlagsState(user, { withReasons: true });
    const json = state.toJSON() as any;
    const flagsState = json.$flagsState;

    // A flag with no override keeps its tracking fields.
    expect(json['plain-tracked']).toBe(true);
    expect(flagsState['plain-tracked'].trackEvents).toBe(true);
    expect(flagsState['plain-tracked'].debugEventsUntilDate).toEqual(debugUntil);

    // The overridden flag and the flag that depends on it stay in the state with their values
    // and marked reasons, but without tracking fields.
    ['overridden-flag', 'dependent-tracked'].forEach((key) => {
      expect(json[key]).toBe(true);
      expect(flagsState[key].reason.overrideAffected).toBe(true);
      expect(flagsState[key]).not.toHaveProperty('trackEvents');
      expect(flagsState[key]).not.toHaveProperty('trackReason');
      expect(flagsState[key]).not.toHaveProperty('debugEventsUntilDate');
    });
    expect(flagsState['overridden-flag'].version).toEqual(7);
  });

  it('returns LaunchDarkly data again when the override is removed', async () => {
    source.setOverrides([]);

    const detail = await client.variationDetail('overridden-flag', user, 'default');

    expect(detail.value).toEqual('ld-value');
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH' });
  });
});

describe('given a client with flag change listeners', () => {
  let updates: string[];
  let source: TestOverrideSource;
  let client: LDClientImpl;

  beforeEach(async () => {
    updates = [];
    const dependent = {
      key: 'dependent',
      version: 1,
      on: true,
      fallthrough: { variation: 0 },
      variations: [true, false],
      rules: [
        {
          id: 'r',
          variation: 1,
          clauses: [{ attribute: '', op: 'segmentMatch', values: ['segment1'] }],
        },
      ],
    };
    const platform = makeFDv2Platform(
      fdv2FullPayload(
        { dependent, unrelated: singleValueFlag('unrelated', true) },
        { segment1: { key: 'segment1', version: 1 } },
      ),
    );
    source = new TestOverrideSource();
    client = makeFDv2Client(
      platform,
      { dataSystem: { overrides: source } },
      makeCallbacks((key) => updates.push(key), true),
    );
    await client.waitForInitialization({ timeout: 5 });
    await settle();
    updates = [];
  });

  afterEach(() => {
    client.close();
  });

  it('notifies listeners when an override is added and when it is removed', async () => {
    source.setOverrides([singleValueFlag('overridden-flag', true)]);
    await settle();
    expect(updates).toEqual(['overridden-flag']);

    updates = [];
    source.setOverrides([]);
    await settle();
    expect(updates).toEqual(['overridden-flag']);
  });

  it('notifies the flags that depend on an overridden segment', async () => {
    source.setOverrides([], [{ key: 'segment1', version: 99 }]);
    await settle();
    expect(updates).toEqual(['dependent']);
  });
});

// A persistent store whose initialization check never answers, as a store that cannot be reached
// while its first connection attempt is pending. Reads report nothing.
function unreachableStore(): LDFeatureStore {
  return {
    get: (_kind, _key, callback) => callback(null),
    all: (_kind, callback) => callback({}),
    init: (_data, callback) => callback(),
    delete: (_kind, _key, _version, callback) => callback(),
    upsert: (_kind, _data, callback) => callback(),
    initialized: () => {},
    close: () => {},
    getDescription: () => 'unreachable',
  } as LDFeatureStore;
}

// A platform whose every request is rejected with 401, so that initialization fails.
function unauthorizedPlatform() {
  const platform = createBasicPlatform();
  platform.requests.fetch = jest.fn(() =>
    Promise.resolve({ status: 401, headers: new Headers(), text: async () => '' }),
  ) as any;
  return platform;
}

describe('given an uninitialized client over a persistent store that does not answer', () => {
  let client: LDClientImpl;

  beforeEach(() => {
    const source = new TestOverrideSource({ flags: [singleValueFlag('overridden-flag', true)] });
    client = makeFDv2Client(makeFDv2Platform(), {
      logger: makeMockLogger(),
      dataSystem: { overrides: source, persistentStore: unreachableStore() },
    });
  });

  afterEach(() => {
    client.close();
  });

  it('serves an override without asking the store whether it is initialized', async () => {
    // With a persistent store the initialization check is I/O. An override is read before it,
    // so a store that never answers does not delay an overridden flag.
    const outcome = await Promise.race([
      client.boolVariationDetail('overridden-flag', user, false),
      sleep(200).then(() => 'still waiting after 200 ms'),
    ]);

    expect(outcome).toEqual(
      expect.objectContaining({
        value: true,
        reason: { kind: 'FALLTHROUGH', overrideAffected: true },
      }),
    );
  });
});

describe('given a client whose initialization fails and an override source with an asynchronous initial load', () => {
  let source: TestOverrideSource;
  let client: LDClientImpl;
  let callbacks: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    source = new TestOverrideSource(undefined, true);
    callbacks = makeCallbacks();
    client = makeFDv2Client(
      unauthorizedPlatform() as any,
      { logger: makeMockLogger(), dataSystem: { overrides: source } },
      callbacks,
    );
  });

  afterEach(() => {
    client.close();
  });

  const completeLoad = () => {
    source.setOverrides([singleValueFlag('overridden-flag', true)]);
    source.completeStart();
  };

  it('reports the failed start only after the initial load', async () => {
    // A failed start is still the completion of the start operation, so it waits for the load.
    // An application that handles the failure and evaluates anyway sees the overrides.
    let outcome: string | undefined;
    const pending = client.waitForInitialization({ timeout: 5 }).then(
      () => {
        outcome = 'resolved';
      },
      () => {
        outcome = 'rejected';
      },
    );
    await waitFor(() => (callbacks.onFailed as jest.Mock).mock.calls.length > 0);
    await sleep(10);
    expect(outcome).toBeUndefined();

    completeLoad();
    await pending;

    expect(outcome).toEqual('rejected');
    expect(await client.boolVariation('overridden-flag', user, false)).toBe(true);
  });

  it('waits for the initial load when the start had already failed', async () => {
    await waitFor(() => (callbacks.onFailed as jest.Mock).mock.calls.length > 0);

    let outcome: string | undefined;
    const pending = client.waitForInitialization({ timeout: 5 }).then(
      () => {
        outcome = 'resolved';
      },
      () => {
        outcome = 'rejected';
      },
    );
    await sleep(10);
    expect(outcome).toBeUndefined();

    completeLoad();
    await pending;

    expect(outcome).toEqual('rejected');
    expect(await client.boolVariation('overridden-flag', user, false)).toBe(true);
  });
});

describe('given an override source with an asynchronous initial load', () => {
  let source: TestOverrideSource;
  let client: LDClientImpl;

  beforeEach(() => {
    source = new TestOverrideSource(undefined, true);
    client = makeFDv2Client(makeFDv2Platform(), { dataSystem: { overrides: source } });
  });

  afterEach(() => {
    client.close();
  });

  it('does not make an evaluation wait for the initial load', async () => {
    // Evaluation never waits on the source. Before the load completes the layer is empty, so a
    // flag the layer does not hold gets the not-ready default, and the call settles at once.
    const detail = await client.boolVariationDetail('overridden-flag', user, false);
    expect(detail.value).toBe(false);
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });

    source.setOverrides([singleValueFlag('overridden-flag', true)]);
    source.completeStart();
    await settle();

    const afterLoad = await client.boolVariationDetail('overridden-flag', user, false);
    expect(afterLoad.value).toBe(true);
    expect(afterLoad.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
  });

  it('does not make the all flags state wait for the initial load', async () => {
    const state = await client.allFlagsState(user);
    expect(state.valid).toBe(false);
    expect(state.allValues()).toEqual({});

    source.setOverrides([singleValueFlag('overridden-flag', true)]);
    source.completeStart();
    await settle();

    const afterLoad = await client.allFlagsState(user);
    expect(afterLoad.valid).toBe(true);
    expect(afterLoad.allValues()).toEqual({ 'overridden-flag': true });
  });

  it('settles an evaluation promptly when the start never completes', async () => {
    // A source whose initial load hangs, for example a hung read of a network file system or a
    // custom source waiting on an unreachable endpoint, must not hold up flag evaluation.
    client.close();
    const hanging = {
      start: () =>
        new Promise<void>(() => {
          // Never settles.
        }),
      close: () => {},
    };
    client = makeFDv2Client(makeFDv2Platform(), { dataSystem: { overrides: hanging } });

    const outcome = await Promise.race([
      client.boolVariation('some-flag', user, false).then(() => 'settled'),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('hung'), 500);
      }),
    ]);
    expect(outcome).toBe('settled');
  });
});

describe('given an initialized client and an override source with an asynchronous initial load', () => {
  let source: TestOverrideSource;
  let client: LDClientImpl;

  beforeEach(() => {
    source = new TestOverrideSource(undefined, true);
    client = makeFDv2Client(
      makeFDv2Platform(fdv2FullPayload({ 'ld-flag': singleValueFlag('ld-flag', true) })),
      {
        dataSystem: { overrides: source },
      },
    );
  });

  afterEach(() => {
    client.close();
  });

  it('completes waitForInitialization only after the initial load', async () => {
    // The initial load is part of starting the client, so the start handle resolves after it.
    let resolved = false;
    const pending = client.waitForInitialization({ timeout: 5 }).then(() => {
      resolved = true;
    });
    await settle();
    expect(client.initialized()).toBe(true);
    expect(resolved).toBe(false);

    source.setOverrides([singleValueFlag('overridden-flag', true)]);
    source.completeStart();
    await pending;
    expect(resolved).toBe(true);
    const detail = await client.boolVariationDetail('overridden-flag', user, false);
    expect(detail.value).toBe(true);
  });

  it('lets waitForInitialization time out when the initial load does not complete', async () => {
    await expect(client.waitForInitialization({ timeout: 0.1 })).rejects.toThrow(
      /waitForInitialization/,
    );
    // Evaluation was never held up by the load.
    const detail = await client.boolVariationDetail('ld-flag', user, false);
    expect(detail.value).toBe(true);
  });

  it('completes waitForInitialization without waiting once the load has completed', async () => {
    source.completeStart();
    await settle();
    await expect(client.waitForInitialization({ timeout: 1 })).resolves.toBe(client);
  });
});

describe('given override source lifecycle and configuration', () => {
  let client: LDClientImpl | undefined;

  afterEach(() => {
    client?.close();
    client = undefined;
  });

  it('starts the source when the client is created and closes it with the client', () => {
    const source = new TestOverrideSource();
    client = makeFDv2Client(makeFDv2Platform(), { dataSystem: { overrides: source } });
    expect(source.started).toBe(true);
    expect(source.closed).toBe(false);

    client.close();
    expect(source.closed).toBe(true);
  });

  it('logs and continues the shutdown when the source fails to close', () => {
    const logger = makeMockLogger();
    const throwing = {
      start: () => {},
      close: () => {
        throw new Error('close failed');
      },
    };
    const store = new InMemoryFeatureStore();
    const storeClose = jest.spyOn(store, 'close');
    const created = makeFDv2Client(makeFDv2Platform(), {
      logger,
      dataSystem: { overrides: throwing, persistentStore: store },
    });
    client = created;

    // The failure is logged, and the components that close after the source still close.
    expect(() => created.close()).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('close failed'));
    expect(storeClose).toHaveBeenCalledTimes(1);
  });

  it('does not start the source in offline mode', async () => {
    const source = new TestOverrideSource({ flags: [singleValueFlag('overridden-flag', true)] });
    client = makeFDv2Client(makeFDv2Platform(), {
      offline: true,
      dataSystem: { overrides: source },
    });

    expect(source.started).toBe(false);
    expect(await client.boolVariation('overridden-flag', user, false)).toBe(false);
  });

  it('accepts a factory function for the source', () => {
    const source = new TestOverrideSource();
    const factory = jest.fn((_clientContext: LDClientContext) => source);
    client = makeFDv2Client(makeFDv2Platform(), { dataSystem: { overrides: factory } });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory.mock.calls[0][0].basicConfiguration.sdkKey).toEqual('sdk-key-overrides');
    expect(source.started).toBe(true);
  });

  it('fails client construction for a configuration that is not a source', () => {
    expect(() =>
      makeFDv2Client(makeFDv2Platform(), {
        dataSystem: { overrides: { start: 'not a function' } as any },
      }),
    ).toThrow('Unsupported override source configuration');
  });

  it('warns and ignores an override option of the wrong type', async () => {
    const logger = makeMockLogger();
    client = makeFDv2Client(makeFDv2Platform(), {
      logger,
      dataSystem: { overrides: 'not an override source' as any },
    });

    expect(warningsMatching(logger, /dataSystem\.overrides/)).toEqual(1);
    const detail = await client.boolVariationDetail('overridden-flag', user, false);
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });
  });

  it('logs and continues when the initial load fails', async () => {
    const logger = makeMockLogger();
    const failing = {
      start: () => Promise.reject(new Error('load failed')),
      close: () => {},
    };
    client = makeFDv2Client(makeFDv2Platform(), { logger, dataSystem: { overrides: failing } });

    const detail = await client.boolVariationDetail('overridden-flag', user, false);
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('load failed'));
  });

  it('logs and continues when start throws', async () => {
    const logger = makeMockLogger();
    const throwing = {
      start: (_sink: LDOverrideSink) => {
        throw new Error('start failed');
      },
      close: () => {},
    };
    client = makeFDv2Client(makeFDv2Platform(), { logger, dataSystem: { overrides: throwing } });

    const detail = await client.boolVariationDetail('overridden-flag', user, false);
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('start failed'));
  });

  it('behaves as before when no override source is configured', async () => {
    client = makeFDv2Client(
      makeFDv2Platform(fdv2FullPayload({ flag: singleValueFlag('flag', 'x') })),
      {},
    );
    await client.waitForInitialization({ timeout: 5 });

    const detail = await client.variationDetail('flag', user, 'default');
    expect(detail.value).toEqual('x');
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH' });
  });
});
