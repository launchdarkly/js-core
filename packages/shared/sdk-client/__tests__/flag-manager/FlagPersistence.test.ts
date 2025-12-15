/* eslint-disable @typescript-eslint/no-use-before-define */
import { Context, Crypto, Hasher, LDLogger, Platform, Storage } from '@launchdarkly/js-sdk-common';

import FlagPersistence from '../../src/flag-manager/FlagPersistence';
import { createDefaultFlagStore } from '../../src/flag-manager/FlagStore';
import FlagUpdater from '../../src/flag-manager/FlagUpdater';
import {
  namespaceForContextData,
  namespaceForContextIndex,
} from '../../src/storage/namespaceUtils';
import { Flag, Flags } from '../../src/types';

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
      new FlagUpdater(flagStore, mockLogger),
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
      makeMockPlatform(
        makeCorruptStorage(), // storage that corrupts data
        makeMockCrypto(),
      ),
      TEST_NAMESPACE,
      5,
      flagStore,
      new FlagUpdater(flagStore, mockLogger),
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
    const flagUpdater = new FlagUpdater(flagStore, mockLogger);
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

  test('loadCached migrates pre 10.3.1 cached flags', async () => {
    const flagStore = createDefaultFlagStore();
    const memoryStorage = makeMemoryStorage();
    const mockLogger = makeMockLogger();
    const flagUpdater = new FlagUpdater(flagStore, mockLogger);
    const fpUnderTest = new FlagPersistence(
      makeMockPlatform(memoryStorage, makeMockCrypto()),
      TEST_NAMESPACE,
      5,
      flagStore,
      flagUpdater,
      mockLogger,
    );

    const context = Context.fromLDContext({ kind: 'org', key: 'TestyPizza' });

    // put mock old flags into the storage
    const mockOldFlags: Flags = {
      flagA: makeMockFlag(),
    };
    memoryStorage.set(context.canonicalKey, JSON.stringify(mockOldFlags));

    const didLoadCache = await fpUnderTest.loadCached(context);
    expect(didLoadCache).toEqual(true);

    // expect migration to have deleted data at old location
    expect(await memoryStorage.get(context.canonicalKey)).toBeNull();
  });

  test('init successfully persists flags', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = new FlagUpdater(flagStore, mockLogger);

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
    expect(await memoryStorage.get(contextDataKey)).toContain('flagA');
  });

  test('init prunes cached contexts above max', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = new FlagUpdater(flagStore, mockLogger);

    const fpUnderTest = new FlagPersistence(
      mockPlatform,
      TEST_NAMESPACE,
      1, // max of 1 for this test
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

  test('init kicks timestamp', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = new FlagUpdater(flagStore, mockLogger);

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
    const flagUpdater = new FlagUpdater(flagStore, mockLogger);

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

    // check memory flag store and persistence
    expect(flagStore.get('flagA')?.version).toEqual(2);
    expect(await memoryStorage.get(contextDataKey)).toContain('"version":2');
  });

  test('upsert ignores inactive context', async () => {
    const memoryStorage = makeMemoryStorage();
    const mockPlatform = makeMockPlatform(memoryStorage, makeMockCrypto());
    const flagStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const flagUpdater = new FlagUpdater(flagStore, mockLogger);

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
});

function makeMockPlatform(storage: Storage, crypto: Crypto): Platform {
  return {
    storage,
    crypto,
    info: {
      platformData: jest.fn(),
      sdkData: jest.fn(),
    },
    requests: {
      fetch: jest.fn(),
      createEventSource: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
  };
}

function makeMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => {
      const value = data.get(key);
      return value !== undefined ? value : null; // mapping undefined to null to satisfy interface
    },
    set: async (key: string, value: string) => {
      data.set(key, value);
    },
    clear: async (key: string) => {
      data.delete(key);
    },
  };
}

function makeCorruptStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => {
      const value = data.get(key);
      return value !== undefined ? 'corruption!!!!!' : null; // mapping undefined to null to satisfy interface
    },
    set: async (key: string, value: string) => {
      data.set(key, value);
    },
    clear: async (key: string) => {
      data.delete(key);
    },
  };
}

function makeMockCrypto() {
  let counter = 0;
  let lastInput = '';
  const hasher: Hasher = {
    update: jest.fn((input) => {
      lastInput = input;
      return hasher;
    }),
    digest: jest.fn(() => `${lastInput}Hashed`),
  };

  return {
    createHash: jest.fn(() => hasher),
    createHmac: jest.fn(),
    randomUUID: jest.fn(() => {
      counter += 1;
      // Will provide a unique value for tests.
      // Very much not a UUID of course.
      return `${counter}`;
    }),
  };
}

function makeMockLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

function makeMockFlag(version: number = 1): Flag {
  // the values of the flag object itself are not relevant for these tests, the
  // version on the item descriptor is what matters
  return {
    version,
    flagVersion: version,
    value: undefined,
    variation: 0,
    trackEvents: false,
  };
}

function makeIncrementingStamper(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}
