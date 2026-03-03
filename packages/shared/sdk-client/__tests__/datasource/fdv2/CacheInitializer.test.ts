import { Context, Crypto, Storage } from '@launchdarkly/js-sdk-common';

import { createCacheInitializerFactory } from '../../../src/datasource/fdv2/CacheInitializer';
import { Initializer } from '../../../src/datasource/fdv2/Initializer';
import { namespaceForContextData } from '../../../src/storage/namespaceUtils';
import { Flag, Flags } from '../../../src/types';
import {
  makeMemoryStorage,
  makeMockCrypto,
  makeMockFlag,
  makeMockLogger,
} from '../../flag-manager/flagManagerTestHelpers';

const TEST_NAMESPACE = 'TestNamespace';
const noSelector = () => undefined;

async function storeFlagsForContext(
  storage: Storage,
  crypto: Crypto,
  context: Context,
  flags: Flags,
) {
  const storageKey = await namespaceForContextData(crypto, TEST_NAMESPACE, context);
  await storage.set(storageKey, JSON.stringify(flags));
}

function createInitializer(
  storage: Storage | undefined,
  crypto: Crypto,
  context: Context,
  logger?: ReturnType<typeof makeMockLogger>,
): Initializer {
  const factory = createCacheInitializerFactory({
    storage,
    crypto,
    environmentNamespace: TEST_NAMESPACE,
    context,
    logger,
  });
  return factory(noSelector);
}

describe('CacheInitializer', () => {
  let crypto: Crypto;
  let context: Context;

  beforeEach(() => {
    crypto = makeMockCrypto();
    context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
  });

  it('returns a changeSet with cached flags when cache is present', async () => {
    const storage = makeMemoryStorage();
    const flags: Flags = {
      flag1: makeMockFlag(1, 'value1'),
      flag2: makeMockFlag(2, 'value2'),
    };
    await storeFlagsForContext(storage, crypto, context, flags);

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.updates).toHaveLength(2);

      const flag1Update = result.payload.updates.find((u) => u.key === 'flag1');
      expect(flag1Update).toBeDefined();
      expect(flag1Update!.kind).toBe('flagEval');
      expect(flag1Update!.version).toBe(1);

      const flag2Update = result.payload.updates.find((u) => u.key === 'flag2');
      expect(flag2Update).toBeDefined();
      expect(flag2Update!.kind).toBe('flagEval');
      expect(flag2Update!.version).toBe(2);
    }
  });

  it('returns a payload with no state field (no selector)', async () => {
    const storage = makeMemoryStorage();
    await storeFlagsForContext(storage, crypto, context, { flag1: makeMockFlag() });

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.state).toBeUndefined();
    }
  });

  it('returns a payload with type full', async () => {
    const storage = makeMemoryStorage();
    await storeFlagsForContext(storage, crypto, context, { flag1: makeMockFlag() });

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.type).toBe('full');
    }
  });

  it('does not set fdv1Fallback', async () => {
    const storage = makeMemoryStorage();
    await storeFlagsForContext(storage, crypto, context, { flag1: makeMockFlag() });

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.fdv1Fallback).toBe(false);
  });

  it('strips version from flag when constructing the evaluation result object', async () => {
    const storage = makeMemoryStorage();
    const flag = makeMockFlag(5, 'hello');
    await storeFlagsForContext(storage, crypto, context, { myFlag: flag });

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      const update = result.payload.updates[0];
      expect(update.version).toBe(5);
      // The object should NOT have a 'version' field — it's a FlagEvaluationResult
      expect(update.object).not.toHaveProperty('version');
      expect(update.object.value).toBe('hello');
      expect(update.object.flagVersion).toBe(5);
      expect(update.object.variation).toBe(0);
      expect(update.object.trackEvents).toBe(false);
    }
  });

  it('returns interrupted on cache miss', async () => {
    const storage = makeMemoryStorage();

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
    }
  });

  it('returns interrupted when storage is undefined', async () => {
    const logger = makeMockLogger();
    const initializer = createInitializer(undefined, crypto, context, logger);
    const result = await initializer.run();

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
    }
    expect(logger.debug).toHaveBeenCalledWith('No storage available for cache initializer');
  });

  it('returns interrupted on corrupt JSON and logs warning', async () => {
    const storage = makeMemoryStorage();
    const storageKey = await namespaceForContextData(crypto, TEST_NAMESPACE, context);
    await storage.set(storageKey, 'not valid json!!!');

    const logger = makeMockLogger();
    const initializer = createInitializer(storage, crypto, context, logger);
    const result = await initializer.run();

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
    }
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not parse cached flag evaluations'),
    );
  });

  it('returns shutdown when close is called before cache loads', async () => {
    // Create a storage that delays responses
    let resolveGet: ((value: string | null) => void) | undefined;
    const slowStorage: Storage = {
      get: () =>
        new Promise<string | null>((resolve) => {
          resolveGet = resolve;
        }),
      set: async () => {},
      clear: async () => {},
    };

    const initializer = createInitializer(slowStorage, crypto, context);
    const runPromise = initializer.run();

    // Close before the storage responds
    initializer.close();

    const result = await runPromise;
    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('shutdown');
    }

    // Resolve the pending get to avoid dangling promise
    resolveGet?.(null);
  });

  it('finds data at legacy canonical key', async () => {
    const storage = makeMemoryStorage();
    const flags: Flags = { legacyFlag: makeMockFlag(3, 'legacy-value') };

    // Store under canonical key (pre-10.3.1 location)
    await storage.set(context.canonicalKey, JSON.stringify(flags));

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.updates).toHaveLength(1);
      expect(result.payload.updates[0].key).toBe('legacyFlag');
      expect(result.payload.updates[0].version).toBe(3);
    }
  });

  it('ignores selectorGetter parameter', async () => {
    const storage = makeMemoryStorage();
    await storeFlagsForContext(storage, crypto, context, { flag1: makeMockFlag() });

    const selectorGetter = jest.fn(() => 'some-selector');
    const factory = createCacheInitializerFactory({
      storage,
      crypto,
      environmentNamespace: TEST_NAMESPACE,
      context,
    });

    const initializer = factory(selectorGetter);
    const result = await initializer.run();

    expect(result.type).toBe('changeSet');
    // selectorGetter should never have been called
    expect(selectorGetter).not.toHaveBeenCalled();
  });

  it('handles empty flag set in cache', async () => {
    const storage = makeMemoryStorage();
    await storeFlagsForContext(storage, crypto, context, {});

    const initializer = createInitializer(storage, crypto, context);
    const result = await initializer.run();

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.updates).toHaveLength(0);
      expect(result.payload.type).toBe('full');
    }
  });

  it('preserves all flag fields in the evaluation result object', async () => {
    const storage = makeMemoryStorage();
    const flag: Flag = {
      version: 1,
      flagVersion: 10,
      value: { complex: 'value' },
      variation: 2,
      trackEvents: true,
      trackReason: true,
      reason: { kind: 'OFF' },
      debugEventsUntilDate: 999,
      prerequisites: ['other-flag'],
    };
    await storeFlagsForContext(storage, crypto, context, { complexFlag: flag });

    const initializer = createInitializer(storage, crypto, context);
    const result = (await initializer.run()) as { type: 'changeSet'; payload: any };
    const obj = result.payload.updates[0].object;

    expect(obj.flagVersion).toBe(10);
    expect(obj.value).toEqual({ complex: 'value' });
    expect(obj.variation).toBe(2);
    expect(obj.trackEvents).toBe(true);
    expect(obj.trackReason).toBe(true);
    expect(obj.reason).toEqual({ kind: 'OFF' });
    expect(obj.debugEventsUntilDate).toBe(999);
    expect(obj.prerequisites).toEqual(['other-flag']);
    expect(obj).not.toHaveProperty('version');
  });
});
