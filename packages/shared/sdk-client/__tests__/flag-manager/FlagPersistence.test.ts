import { Context } from '@launchdarkly/js-sdk-common';

import FlagPersistence from '../../src/flag-manager/FlagPersistence';
import { createDefaultFlagStore } from '../../src/flag-manager/FlagStore';
import createFlagUpdater from '../../src/flag-manager/FlagUpdater';
import {
  namespaceForContextData,
  namespaceForContextIndex,
} from '../../src/storage/namespaceUtils';
import { Flags } from '../../src/types';
import {
  makeCorruptStorage,
  makeIncrementingStamper,
  makeMemoryStorage,
  makeMockCrypto,
  makeMockFlag,
  makeMockLogger,
  makeMockPlatform,
} from './flagManagerTestHelpers';

const TEST_NAMESPACE = 'TestNamespace';

describe('FlagPersistence tests', () => {
  test('loadCached returns false when no cache', async () => {
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(makeMemoryStorage(), makeMockCrypto()),
      TEST_NAMESPACE,
      5,
      flagStore,
      createFlagUpdater(flagStore, mockLogger),
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const didLoadCache = await fpUnderTest.loadCached(context);
    expect(didLoadCache).toEqual(false);
  });

  test('loadCached returns false when corrupt cache', async () => {
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(makeCorruptStorage(), makeMockCrypto()),
      TEST_NAMESPACE,
      5,
      flagStore,
      createFlagUpdater(flagStore, mockLogger),
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };

    await fpUnderTest.init(context, flags);
    const didLoadCache = await fpUnderTest.loadCached(context);
    expect(didLoadCache).toEqual(false);
  });

  test('loadCached updates FlagUpdater with cached flags', async () => {
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);
    const flagUpdaterSpy = jest.spyOn(flagUpdater, 'initCached');
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(makeMemoryStorage(), makeMockCrypto()),
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };

    await fpUnderTest.init(context, flags);
    const didLoadCache = await fpUnderTest.loadCached(context);
    expect(didLoadCache).toEqual(true);
    expect(flagUpdaterSpy).toHaveBeenCalledWith(context, flags);
  });

  test('loadCached handles old format (bare flags without freshness wrapper)', async () => {
    const flagStore = createDefaultFlagStore();
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(memoryStorage, crypto),
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });

    // Store in old format (bare Flags object, no wrapper)
    const oldFormatFlags: Flags = { flagA: makeMockFlag() };
    const storageKey = await namespaceForContextData(crypto, TEST_NAMESPACE, context);
    await memoryStorage.set(storageKey, JSON.stringify(oldFormatFlags));

    const didLoadCache = await fpUnderTest.loadCached(context);
    expect(didLoadCache).toEqual(true);
    expect(flagStore.get('flagA')).toBeDefined();
  });

  test('loadCached migrates pre 10.3.1 cached flags', async () => {
    const flagStore = createDefaultFlagStore();
    const memoryStorage = makeMemoryStorage();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(memoryStorage, makeMockCrypto()),
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });

    const mockOldFlags: Flags = {
      flagA: makeMockFlag(),
    };
    memoryStorage.set(context.canonicalKey, JSON.stringify(mockOldFlags));

    const didLoadCache = await fpUnderTest.loadCached(context);
    expect(didLoadCache).toEqual(true);

    expect(await memoryStorage.get(context.canonicalKey)).toBeNull();
  });

  test('init successfully persists flags', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };

    await fpUnderTest.init(context, flags);

    const contextDataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      context,
    );
    const contextIndexKey = await namespaceForContextIndex(TEST_NAMESPACE);
    expect(await memoryStorage.get(contextIndexKey)).toContain(contextDataKey);

    const stored = JSON.parse((await memoryStorage.get(contextDataKey))!);
    expect(stored.flags.flagA).toBeDefined();
  });

  test('init stores freshness alongside flags', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockPlatform = makeMockPlatform(memoryStorage, crypto);
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
      () => 42000,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = { flagA: { version: 1, flag: makeMockFlag() } };

    await fpUnderTest.init(context, flags);

    const contextDataKey = await namespaceForContextData(crypto, TEST_NAMESPACE, context);
    const stored = JSON.parse((await memoryStorage.get(contextDataKey))!);
    expect(stored.freshness).toBeDefined();
    expect(stored.freshness.timestamp).toBe(42000);
    expect(stored.freshness.contextHash).toBeDefined();
  });

  test('init prunes cached contexts above max', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      1,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context1 = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const context2 = Context.fromLDContext({ kind: 'user', key: 'TestyUser' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };

    await fpUnderTest.init(context1, flags);
    await fpUnderTest.init(context2, flags);

    const context1DataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      context1,
    );
    const context2DataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      context2,
    );
    const contextIndexKey = await namespaceForContextIndex(TEST_NAMESPACE);

    const indexData = await memoryStorage.get(contextIndexKey);
    expect(indexData).not.toContain(context1DataKey);
    expect(indexData).toContain(context2DataKey);
    // context1 was pruned — its entire record (flags + freshness) is gone
    expect(await memoryStorage.get(context1DataKey)).toBeNull();
    expect(await memoryStorage.get(context2DataKey)).not.toBeNull();
  });

  test('init kicks timestamp', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
      makeIncrementingStamper(),
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };

    await fpUnderTest.init(context, flags);
    await fpUnderTest.init(context, flags);
    const contextIndexKey = await namespaceForContextIndex(TEST_NAMESPACE);

    const indexData = await memoryStorage.get(contextIndexKey);
    expect(indexData).toContain(`"timestamp":2`);
  });

  test('upsert updates persistence', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flagAv1 = makeMockFlag(1);
    const flagAv2 = makeMockFlag(2);
    const flags = {
      flagA: {
        version: 1,
        flag: flagAv1,
      },
    };

    await fpUnderTest.init(context, flags);
    await fpUnderTest.upsert(context, 'flagA', { version: 2, flag: flagAv2 });

    const contextDataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      context,
    );

    expect(flagStore.get('flagA')?.version).toEqual(2);
    const stored = JSON.parse((await memoryStorage.get(contextDataKey))!);
    expect(stored.flags.flagA.version).toEqual(2);
  });

  test('upsert ignores inactive context', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const activeContext = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const inactiveContext = Context.fromLDContext({ kind: 'user', key: 'TestyUser' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };

    await fpUnderTest.init(activeContext, flags);
    await fpUnderTest.upsert(inactiveContext, 'inactiveContextFlag', {
      version: 1,
      flag: makeMockFlag(),
    });

    const activeContextDataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      activeContext,
    );
    const inactiveContextDataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      inactiveContext,
    );

    expect(await memoryStorage.get(activeContextDataKey)).not.toBeNull();
    expect(await memoryStorage.get(inactiveContextDataKey)).toBeNull();
  });

  test('getFreshness returns timestamp when context attributes match', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockPlatform = makeMockPlatform(memoryStorage, crypto);
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
      () => 99000,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test', name: 'Alice' });
    await fpUnderTest.init(context, { flagA: { version: 1, flag: makeMockFlag() } });

    // Same context — freshness should match
    const sameContext = Context.fromLDContext({ kind: 'user', key: 'test', name: 'Alice' });
    const freshness = await fpUnderTest.getFreshness(sameContext);
    expect(freshness).toBe(99000);
  });

  test('getFreshness returns undefined when context attributes differ', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockPlatform = makeMockPlatform(memoryStorage, crypto);
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
      () => 99000,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test', name: 'Alice' });
    await fpUnderTest.init(context, { flagA: { version: 1, flag: makeMockFlag() } });

    // Same key, different attributes — freshness should be stale
    const changedContext = Context.fromLDContext({ kind: 'user', key: 'test', name: 'Bob' });
    const freshness = await fpUnderTest.getFreshness(changedContext);
    expect(freshness).toBeUndefined();
  });

  test('getFreshness returns undefined when no cache exists', async () => {
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(makeMemoryStorage(), makeMockCrypto()),
      TEST_NAMESPACE,
      5,
      flagStore,
      createFlagUpdater(flagStore, mockLogger),
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test' });
    const freshness = await fpUnderTest.getFreshness(context);
    expect(freshness).toBeUndefined();
  });

  test('getFreshness returns undefined for old format data (no freshness wrapper)', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockPlatform = makeMockPlatform(memoryStorage, crypto);
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      flagStore,
      createFlagUpdater(flagStore, mockLogger),
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test' });
    const storageKey = await namespaceForContextData(crypto, TEST_NAMESPACE, context);
    // Store bare flags (old format)
    await memoryStorage.set(storageKey, JSON.stringify({ flagA: makeMockFlag() }));

    const freshness = await fpUnderTest.getFreshness(context);
    expect(freshness).toBeUndefined();
  });
});
