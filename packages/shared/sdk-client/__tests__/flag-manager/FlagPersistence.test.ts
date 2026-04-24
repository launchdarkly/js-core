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
      false,
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
      false,
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
      false,
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

  test('loadCached migrates pre 10.3.1 cached flags', async () => {
    const flagStore = createDefaultFlagStore();
    const memoryStorage = makeMemoryStorage();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(memoryStorage, makeMockCrypto()),
      TEST_NAMESPACE,
      5,
      false,
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
      false,
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
    expect(await memoryStorage.get(contextDataKey)).toContain('flagA');
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
      false,
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
    expect(await memoryStorage.get(context1DataKey)).toBeNull();
    expect(await memoryStorage.get(context2DataKey)).toContain('flagA');
  });

  test('init prunes freshness keys alongside cached contexts', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockPlatform = makeMockPlatform(memoryStorage, crypto);
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      1,
      false,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context1 = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const context2 = Context.fromLDContext({ kind: 'user', key: 'TestyUser' });
    const flags = { flagA: { version: 1, flag: makeMockFlag() } };

    await fpUnderTest.init(context1, flags);

    const context1DataKey = await namespaceForContextData(crypto, TEST_NAMESPACE, context1);
    expect(await memoryStorage.get(`${context1DataKey}_freshness`)).not.toBeNull();

    await fpUnderTest.init(context2, flags);

    expect(await memoryStorage.get(context1DataKey)).toBeNull();
    expect(await memoryStorage.get(`${context1DataKey}_freshness`)).toBeNull();
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
      false,
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
    expect(indexData).toContain('"timestamp":2');
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
      false,
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
    expect(await memoryStorage.get(contextDataKey)).toContain('"version":2');
  });

  it('does not write to storage when maxCachedContexts is 0', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      0,
      false,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = { flagA: { version: 1, flag: makeMockFlag() } };

    await fpUnderTest.init(context, flags);

    const contextDataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      context,
    );
    expect(await memoryStorage.get(contextDataKey)).toBeNull();
  });

  it('clears previously cached data when maxCachedContexts is 0', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockPlatform = makeMockPlatform(memoryStorage, crypto);
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const contextA = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const storageKeyA = await namespaceForContextData(crypto, TEST_NAMESPACE, contextA);
    const indexKey = await namespaceForContextIndex(TEST_NAMESPACE);

    // Pre-populate storage as if a prior session had maxCachedContexts > 0
    const indexJson = JSON.stringify({ index: [{ id: storageKeyA, timestamp: 1 }] });
    await memoryStorage.set(indexKey, indexJson);
    await memoryStorage.set(storageKeyA, JSON.stringify({ flagA: makeMockFlag() }));

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      0,
      false,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const flags = { flagA: { version: 1, flag: makeMockFlag() } };
    await fpUnderTest.init(contextA, flags);

    // Existing entry must have been evicted
    expect(await memoryStorage.get(storageKeyA)).toBeNull();
    // Index must be saved as empty
    const savedIndex = JSON.parse((await memoryStorage.get(indexKey))!);
    expect(savedIndex.index).toHaveLength(0);
  });

  it('does not load from storage when maxCachedContexts is 0', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    // First write data to storage using a normal FlagPersistence
    const writeFp = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      false,
      flagStore,
      flagUpdater,
      mockLogger,
    );
    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = { flagA: { version: 1, flag: makeMockFlag() } };
    await writeFp.init(context, flags);

    // Now try to load with maxCachedContexts: 0
    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      0,
      false,
      flagStore,
      flagUpdater,
      mockLogger,
    );
    const didLoad = await fpUnderTest.loadCached(context);
    expect(didLoad).toEqual(false);
  });

  it('does not write to storage when disableCache is true', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      true,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = { flagA: { version: 1, flag: makeMockFlag() } };

    await fpUnderTest.init(context, flags);

    const contextDataKey = await namespaceForContextData(
      mockPlatform.crypto,
      TEST_NAMESPACE,
      context,
    );
    expect(await memoryStorage.get(contextDataKey)).toBeNull();
  });

  it('does not load from storage when disableCache is true', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    // First write data to storage using a normal FlagPersistence
    const writeFp = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      false,
      flagStore,
      flagUpdater,
      mockLogger,
    );
    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const flags = { flagA: { version: 1, flag: makeMockFlag() } };
    await writeFp.init(context, flags);

    // Now try to load with disableCache: true
    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      5,
      true,
      flagStore,
      flagUpdater,
      mockLogger,
    );
    const didLoad = await fpUnderTest.loadCached(context);
    expect(didLoad).toEqual(false);
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
      false,
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

  it('does not write to storage when current context is pruned due to equal timestamps', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const mockPlatform = makeMockPlatform(memoryStorage, crypto);
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = createFlagUpdater(flagStore, mockLogger);

    const contextA = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });
    const contextB = Context.fromLDContext({ kind: 'user', key: 'TestyUser' });

    const storageKeyA = await namespaceForContextData(crypto, TEST_NAMESPACE, contextA);
    const storageKeyB = await namespaceForContextData(crypto, TEST_NAMESPACE, contextB);
    const indexKey = await namespaceForContextIndex(TEST_NAMESPACE);

    // Pre-populate storage: index with A before B (same timestamp t=1), and B's flag data
    const indexJson = JSON.stringify({
      index: [
        { id: storageKeyA, timestamp: 1 },
        { id: storageKeyB, timestamp: 1 },
      ],
    });
    await memoryStorage.set(indexKey, indexJson);
    await memoryStorage.set(storageKeyB, JSON.stringify({ flagB: makeMockFlag() }));

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      1,
      false,
      flagStore,
      flagUpdater,
      mockLogger,
      () => 1,
    );

    const flags = { flagA: { version: 1, flag: makeMockFlag() } };
    await fpUnderTest.init(contextA, flags);

    // A was in the pruned list — must not be re-written to storage
    expect(await memoryStorage.get(storageKeyA)).toBeNull();
    // B was not pruned — its existing data should be untouched
    expect(await memoryStorage.get(storageKeyB)).not.toBeNull();
    // Index should contain only B
    const savedIndex = JSON.parse((await memoryStorage.get(indexKey))!);
    expect(savedIndex.index).toHaveLength(1);
    expect(savedIndex.index[0].id).toBe(storageKeyB);
  });
});

describe('FlagPersistence freshness', () => {
  test('init stores freshness record to storage', async () => {
    const memoryStorage = makeMemoryStorage();
    const crypto = makeMockCrypto();
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();

    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(memoryStorage, crypto),
      TEST_NAMESPACE,
      5,
      false,
      flagStore,
      createFlagUpdater(flagStore, mockLogger),
      mockLogger,
      () => 42000,
    );

    const context = Context.fromLDContext({ kind: 'user', key: 'test' });
    await fpUnderTest.init(context, { flagA: { version: 1, flag: makeMockFlag() } });

    const contextDataKey = await namespaceForContextData(crypto, TEST_NAMESPACE, context);
    const freshnessJson = await memoryStorage.get(`${contextDataKey}_freshness`);
    expect(freshnessJson).not.toBeNull();
    const record = JSON.parse(freshnessJson!);
    expect(record.timestamp).toBe(42000);
    expect(record.contextHash).toBeDefined();
  });
});
