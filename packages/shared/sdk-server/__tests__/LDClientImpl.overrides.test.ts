import { LDClientContext, LDLogger } from '@launchdarkly/js-sdk-common';

import { LDOverrideSink } from '../src/api/subsystems';
import LDClientImpl from '../src/LDClientImpl';
import {
  fdv2FullPayload,
  makeCallbacks,
  makeFDv2Client,
  makeFDv2Platform,
  singleValueFlag,
} from './overrides/overridesTestSupport';
import TestOverrideSource from './overrides/TestOverrideSource';

const user = { key: 'user-key' };

function makeLogger(): LDLogger & { warn: jest.Mock; error: jest.Mock } {
  return { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
}

function warningsMatching(logger: { warn: jest.Mock }, pattern: RegExp): number {
  return logger.warn.mock.calls.filter((call) => pattern.test(String(call[0]))).length;
}

// Change notifications and asynchronous starts complete on later turns of the event loop.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 10);
  });

describe('given an uninitialized client with an override source', () => {
  let source: TestOverrideSource;
  let client: LDClientImpl;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
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
    expect(detail.reason).toEqual({ kind: 'OFF', overrideAffected: true });
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

  it('reports only the override layer in the all flags state and warns once', async () => {
    const state = await client.allFlagsState(user, { withReasons: true });

    expect(state.valid).toBe(true);
    expect(state.allValues()).toEqual({ 'overridden-flag': true });
    expect(state.getFlagReason('overridden-flag')).toEqual({ kind: 'OFF', overrideAffected: true });

    await client.allFlagsState(user);
    expect(warningsMatching(logger, /returning only flags from the override layer/)).toEqual(1);
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
    expect(detail.reason).toEqual({ kind: 'OFF' });
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
    expect(detail.reason).toEqual({ kind: 'OFF' });
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

  it('waits for the initial load before evaluating', async () => {
    let resolved = false;
    const pending = client.boolVariationDetail('overridden-flag', user, false).then((detail) => {
      resolved = true;
      return detail;
    });
    await settle();
    expect(resolved).toBe(false);

    source.setOverrides([singleValueFlag('overridden-flag', true)]);
    source.completeStart();

    const detail = await pending;
    expect(detail.value).toBe(true);
    expect(detail.reason).toEqual({ kind: 'OFF', overrideAffected: true });
  });

  it('waits for the initial load before reporting the all flags state', async () => {
    let resolved = false;
    const pending = client.allFlagsState(user).then((state) => {
      resolved = true;
      return state;
    });
    await settle();
    expect(resolved).toBe(false);

    source.setOverrides([singleValueFlag('overridden-flag', true)]);
    source.completeStart();

    const state = await pending;
    expect(state.valid).toBe(true);
    expect(state.allValues()).toEqual({ 'overridden-flag': true });
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
    const logger = makeLogger();
    client = makeFDv2Client(makeFDv2Platform(), {
      logger,
      dataSystem: { overrides: 'not an override source' as any },
    });

    expect(warningsMatching(logger, /dataSystem\.overrides/)).toEqual(1);
    const detail = await client.boolVariationDetail('overridden-flag', user, false);
    expect(detail.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });
  });

  it('logs and continues when the initial load fails', async () => {
    const logger = makeLogger();
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
    const logger = makeLogger();
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
    expect(detail.reason).toEqual({ kind: 'OFF' });
  });
});
