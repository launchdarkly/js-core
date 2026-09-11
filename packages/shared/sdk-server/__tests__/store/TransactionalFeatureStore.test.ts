import { LDLogger } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../../src/api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
  LDTransactionalFeatureStore,
} from '../../src/api/subsystems';
import AsyncTransactionalStoreFacade from '../../src/store/AsyncTransactionalStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import TransactionalFeatureStore from '../../src/store/TransactionalFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

describe('given a non transactional store', () => {
  let mockNontransactionalStore: LDTransactionalFeatureStore;
  let transactionalStore: TransactionalFeatureStore;

  let nonTransactionalFacade: AsyncTransactionalStoreFacade;
  let transactionalFacade: AsyncTransactionalStoreFacade;

  beforeEach(() => {
    mockNontransactionalStore = new InMemoryFeatureStore();
    transactionalStore = new TransactionalFeatureStore(mockNontransactionalStore);

    // these two facades are used to make test writing easier
    nonTransactionalFacade = new AsyncTransactionalStoreFacade(mockNontransactionalStore);
    transactionalFacade = new AsyncTransactionalStoreFacade(transactionalStore);
  });

  afterEach(() => {
    transactionalFacade.close();
    jest.restoreAllMocks();
  });

  it('applies changes to non transactional store', async () => {
    await transactionalFacade.applyChanges(
      false,
      {
        features: {
          key1: {
            version: 2,
          },
          key2: {
            version: 3,
          },
        },
        segments: {
          seg1: {
            version: 4,
          },
          seg2: {
            version: 5,
          },
        },
      },
      undefined,
      'selector1',
    );
    expect(await nonTransactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        key: 'key1',
        version: 2,
      },
      key2: {
        key: 'key2',
        version: 3,
      },
    });
    expect(await nonTransactionalFacade.all(VersionedDataKinds.Segments)).toEqual({
      seg1: {
        key: 'seg1',
        version: 4,
      },
      seg2: {
        key: 'seg2',
        version: 5,
      },
    });
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        key: 'key1',
        version: 2,
      },
      key2: {
        key: 'key2',
        version: 3,
      },
    });
    expect(await transactionalFacade.all(VersionedDataKinds.Segments)).toEqual({
      seg1: {
        key: 'seg1',
        version: 4,
      },
      seg2: {
        key: 'seg2',
        version: 5,
      },
    });
  });

  it('it reads through to non transactional store before basis is provided', async () => {
    await nonTransactionalFacade.init({
      features: {
        key1: {
          version: 1,
        },
      },
    });
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });
  });

  it('it switches to memory store when basis is provided', async () => {
    // situate some mock data in non transactional store
    await nonTransactionalFacade.init({
      features: {
        nontransactionalFeature: {
          version: 1,
        },
      },
    });

    await transactionalFacade.applyChanges(
      true,
      {
        features: {
          key1: {
            version: 1,
          },
        },
      },
      undefined,
      'selector1',
    );

    expect(await nonTransactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });

    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });

    // corrupt non transactional store and then read from transactional store to prove it is not
    // using underlying non transactional store for reads
    await nonTransactionalFacade.init({
      features: {
        nontransactionalFeature: {
          version: 1,
        },
      },
    });

    // still should read from memory
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });
  });

  it('exposes the selector tracked by the memory store before a basis is provided', async () => {
    // non-basis changes still flow through the memory store, so its tracked selector should
    // update even though the active store (used for reads) is still the persistence store
    await transactionalFacade.applyChanges(
      false,
      {
        features: {
          key1: {
            version: 1,
          },
        },
      },
      undefined,
      'selector-before-basis',
    );

    expect(transactionalStore.getSelector()).toEqual('selector-before-basis');
  });

  it('does not expose init metadata set directly on the persistence store before a basis is provided', async () => {
    // metadata set directly on the persistence store (the active store pre-basis) should not
    // be visible through the transactional wrapper, which always reads from the memory store
    await nonTransactionalFacade.init(
      {
        features: {
          key1: {
            version: 1,
          },
        },
      },
      { environmentId: 'env-on-persistence-store' },
    );

    expect(transactionalStore.getInitMetaData()).toBeUndefined();
  });

  it('exposes selector and init metadata from the memory store after a basis is provided', async () => {
    const initMetadata = { environmentId: 'env-after-basis' };

    await transactionalFacade.applyChanges(
      true,
      {
        features: {
          key1: {
            version: 1,
          },
        },
      },
      initMetadata,
      'selector-after-basis',
    );

    expect(transactionalStore.getSelector()).toEqual('selector-after-basis');
    expect(transactionalStore.getInitMetaData()).toEqual(initMetadata);
  });
});

class MockPersistenceStore implements LDFeatureStore {
  failInits = false;

  failUpserts = false;

  // Throws synchronously from init() instead of reporting failure through the
  // callback. Simulates a persistence client that raises before it can call back.
  throwOnInit = false;

  // Returns a rejected promise from init() instead of calling back. Simulates an
  // `async` persistence client whose promise rejects before it reaches its callback.
  rejectOnInit = false;

  // Throws synchronously from upsert() instead of reporting failure through the
  // callback. Simulates a persistence client that raises before it can call back.
  throwOnUpsert = false;

  // Returns a rejected promise from upsert() instead of calling back. Simulates an
  // `async` persistence client whose promise rejects before it reaches its callback.
  rejectOnUpsert = false;

  // Defers the init() callback instead of invoking it. Lets a test hold a write-back
  // attempt open, e.g. to simulate one completing after the store is closed.
  deferInit = false;

  pendingInitCallbacks: ((err?: Error) => void)[] = [];

  initCalls: LDFeatureStoreDataStorage[] = [];

  upsertCalls: LDKeyedFeatureStoreItem[] = [];

  closeCalls = 0;

  isStoreAvailable?: (callback: (isAvailable: boolean) => void) => void;

  get(_kind: DataKind, _key: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    callback(null);
  }

  all(_kind: DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    callback({});
  }

  init(allData: LDFeatureStoreDataStorage, callback: (err?: Error) => void): void {
    if (this.throwOnInit) {
      throw new Error('init exploded');
    }
    this.initCalls.push(allData);
    if (this.rejectOnInit) {
      // Cast needed: the interface types init() as returning void, but a persistence
      // client that is actually `async` can return a rejected promise at runtime.
      return Promise.reject(new Error('init rejected')) as unknown as void;
    }
    if (this.deferInit) {
      this.pendingInitCallbacks.push(callback);
      return;
    }
    callback(this.failInits ? new Error('init failed') : undefined);
  }

  delete(_kind: DataKind, _key: string, _version: number, callback: () => void): void {
    callback();
  }

  upsert(_kind: DataKind, data: LDKeyedFeatureStoreItem, callback: (err?: Error) => void): void {
    if (this.throwOnUpsert) {
      throw new Error('upsert exploded');
    }
    this.upsertCalls.push(data);
    if (this.rejectOnUpsert) {
      // Cast needed: the interface types upsert() as returning void, but a
      // persistence client that is actually `async` can return a rejected promise
      // at runtime.
      return Promise.reject(new Error('upsert rejected')) as unknown as void;
    }
    callback(this.failUpserts ? new Error('upsert failed') : undefined);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    callback(true);
  }

  close(): void {
    this.closeCalls += 1;
  }

  getDescription(): string {
    return 'mock persistence store';
  }
}

function makeLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

it('marks the store available without a write-back when a pre-basis write recovers', async () => {
  const persistence = new MockPersistenceStore();
  const logger = makeLogger();
  const store = new TransactionalFeatureStore(persistence, logger);
  const facade = new AsyncTransactionalStoreFacade(store);
  try {
    persistence.failUpserts = true;
    await facade.applyChanges(false, { features: { flagA: { version: 1 } } }, undefined, 's1');
    expect(logger.warn).toHaveBeenCalledTimes(1);

    persistence.failUpserts = false;
    const initCallsBefore = persistence.initCalls.length;
    await facade.applyChanges(false, { features: { flagB: { version: 1 } } }, undefined, 's2');

    expect(logger.info).toHaveBeenCalledTimes(1);
    // No basis was ever received, so there is no full data set to write back.
    expect(persistence.initCalls.length).toEqual(initCallsBefore);
  } finally {
    store.close();
  }
});

describe('given a transactional store over a persistence store that can fail writes', () => {
  let persistence: MockPersistenceStore;
  let logger: LDLogger;
  let recoveryStore: TransactionalFeatureStore;
  let recoveryFacade: AsyncTransactionalStoreFacade;

  beforeEach(async () => {
    persistence = new MockPersistenceStore();
    logger = makeLogger();
    recoveryStore = new TransactionalFeatureStore(persistence, logger);
    recoveryFacade = new AsyncTransactionalStoreFacade(recoveryStore);

    await recoveryFacade.applyChanges(
      true,
      {
        features: {
          flagA: { key: 'flagA', version: 1 },
        },
        segments: {},
      },
      undefined,
      'selector1',
    );
    // Delete flagA so the memory store holds a tombstone.
    await recoveryFacade.delete(VersionedDataKinds.Features, 'flagA', 2);
  });

  afterEach(() => {
    recoveryStore.close();
  });

  it('logs one warning when writes start failing', async () => {
    persistence.failUpserts = true;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagB: { version: 1 } } },
      undefined,
      's2',
    );
    await recoveryFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Persistent store is unavailable. Updates will be kept in memory until it recovers.',
    );
  });

  it('marks the store unavailable when a basis write fails and still completes the change', async () => {
    persistence.failInits = true;
    await recoveryFacade.applyChanges(
      true,
      { features: { flagB: { version: 5 } } },
      undefined,
      's2',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(await recoveryFacade.all(VersionedDataKinds.Features)).toEqual({
      flagB: { version: 5 },
    });
  });

  it('continues to serve reads from memory while the persistence store is unavailable', async () => {
    persistence.failUpserts = true;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagB: { version: 1 } } },
      undefined,
      's2',
    );
    expect(await recoveryFacade.all(VersionedDataKinds.Features)).toEqual({
      flagB: { key: 'flagB', version: 1 },
    });
  });

  it('continues to mirror writes while the persistence store is unavailable', async () => {
    persistence.failUpserts = true;
    const countBefore = persistence.upsertCalls.length;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagB: { version: 1 } } },
      undefined,
      's2',
    );
    await recoveryFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );
    expect(persistence.upsertCalls.length).toEqual(countBefore + 2);
  });

  it('writes the full data set, including tombstones, after a mirrored write succeeds', async () => {
    persistence.failUpserts = true;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagB: { version: 1 } } },
      undefined,
      's2',
    );

    persistence.failUpserts = false;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );

    const lastInit = persistence.initCalls[persistence.initCalls.length - 1];
    expect(lastInit).toEqual({
      features: {
        flagA: { key: 'flagA', version: 2, deleted: true },
        flagB: { key: 'flagB', version: 1 },
        flagC: { key: 'flagC', version: 1 },
      },
      segments: {},
    });
  });

  it('logs one message when the store recovers', async () => {
    persistence.failUpserts = true;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagB: { version: 1 } } },
      undefined,
      's2',
    );
    persistence.failUpserts = false;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );
    await recoveryFacade.applyChanges(
      false,
      { features: { flagD: { version: 1 } } },
      undefined,
      's4',
    );
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Persistent store is available again.');
  });

  it('stays unavailable when the write-back fails and recovers on a later attempt', async () => {
    jest.useFakeTimers();
    try {
      persistence.failUpserts = true;
      persistence.failInits = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagB: { version: 1 } } },
        undefined,
        's2',
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);

      // Mirrored writes succeed again, but the write-back init still fails.
      persistence.failUpserts = false;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalled();

      persistence.failInits = false;
      // The failed attempt embargoes retries for 1000ms before the next real
      // attempt is allowed to run.
      await jest.advanceTimersByTimeAsync(1000);
      await recoveryFacade.applyChanges(
        false,
        { features: { flagD: { version: 1 } } },
        undefined,
        's4',
      );
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores a write-back init that completes after close', async () => {
    persistence.failUpserts = true;
    persistence.failInits = true;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagB: { version: 1 } } },
      undefined,
      's2',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);

    // The next mirrored write succeeds and triggers a write-back attempt, but the
    // persistence store holds the init callback open instead of calling it back.
    persistence.deferInit = true;
    persistence.failUpserts = false;
    await recoveryFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );
    expect(persistence.pendingInitCallbacks.length).toEqual(1);

    recoveryStore.close();
    // The deferred write-back init finally completes after close.
    persistence.pendingInitCallbacks[0]();

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('closes the underlying persistence store exactly once even if close is called twice', () => {
    recoveryStore.close();
    recoveryStore.close();
    expect(persistence.closeCalls).toEqual(1);
  });

  it('fires the callback exactly once for a basis write whose init promise rejects', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      persistence.rejectOnInit = true;
      let callbackCalls = 0;
      await new Promise<void>((resolve) => {
        recoveryStore.applyChanges(
          true,
          { features: { flagB: { version: 5 } } },
          () => {
            callbackCalls += 1;
            resolve();
          },
          undefined,
          's2',
        );
      });
      // Flush any pending microtask that might invoke the callback a second time.
      await Promise.resolve();
      await Promise.resolve();
      expect(callbackCalls).toEqual(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('fires the callback exactly once for a mirrored upsert whose promise rejects', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      persistence.rejectOnUpsert = true;
      let callbackCalls = 0;
      await new Promise<void>((resolve) => {
        recoveryStore.upsert(VersionedDataKinds.Features, { key: 'flagB', version: 1 }, () => {
          callbackCalls += 1;
          resolve();
        });
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(callbackCalls).toEqual(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('fires the callback exactly once when a basis write init throws synchronously', async () => {
    persistence.throwOnInit = true;
    let callbackCalls = 0;
    await new Promise<void>((resolve) => {
      recoveryStore.applyChanges(
        true,
        { features: { flagB: { version: 5 } } },
        () => {
          callbackCalls += 1;
          resolve();
        },
        undefined,
        's2',
      );
    });
    expect(callbackCalls).toEqual(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('fires the callback exactly once when a mirrored upsert throws synchronously', async () => {
    persistence.throwOnUpsert = true;
    let callbackCalls = 0;
    await new Promise<void>((resolve) => {
      recoveryStore.upsert(VersionedDataKinds.Features, { key: 'flagB', version: 1 }, () => {
        callbackCalls += 1;
        resolve();
      });
    });
    expect(callbackCalls).toEqual(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('given a transactional store whose persistence store has an availability check', () => {
  let persistence: MockPersistenceStore;
  let probeResult: boolean;
  let probeCalls: number;
  let logger: LDLogger;
  let pollingStore: TransactionalFeatureStore;
  let pollingFacade: AsyncTransactionalStoreFacade;

  beforeEach(async () => {
    jest.useFakeTimers();
    persistence = new MockPersistenceStore();
    probeResult = false;
    probeCalls = 0;
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      callback(probeResult);
    };
    logger = makeLogger();
    pollingStore = new TransactionalFeatureStore(persistence, logger);
    pollingFacade = new AsyncTransactionalStoreFacade(pollingStore);

    await pollingFacade.applyChanges(
      true,
      { features: { flagA: { key: 'flagA', version: 1 } } },
      undefined,
      'selector1',
    );
    persistence.failUpserts = true;
    persistence.failInits = true;
    await pollingFacade.applyChanges(
      false,
      { features: { flagB: { version: 1 } } },
      undefined,
      's2',
    );
  });

  afterEach(() => {
    pollingStore.close();
    jest.useRealTimers();
  });

  it('polls the availability check every 500 milliseconds while unavailable', async () => {
    await jest.advanceTimersByTimeAsync(1500);
    expect(probeCalls).toEqual(3);
  });

  it('stays unavailable while the check reports the store is not available', async () => {
    await jest.advanceTimersByTimeAsync(2000);
    expect(logger.info).not.toHaveBeenCalled();
    // Only the basis write happened before the outage. No write-back was attempted.
    expect(persistence.initCalls.length).toEqual(1);
  });

  it('writes the full data set back when the check reports the store is available', async () => {
    persistence.failInits = false;
    persistence.failUpserts = false;
    probeResult = true;
    await jest.advanceTimersByTimeAsync(500);

    const lastInit = persistence.initCalls[persistence.initCalls.length - 1];
    expect(lastInit).toEqual({
      features: {
        flagA: { key: 'flagA', version: 1 },
        flagB: { key: 'flagB', version: 1 },
      },
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Persistent store is available again.');
  });

  it('stops polling after recovery', async () => {
    persistence.failInits = false;
    probeResult = true;
    await jest.advanceTimersByTimeAsync(500);
    const callsAfterRecovery = probeCalls;
    await jest.advanceTimersByTimeAsync(5000);
    expect(probeCalls).toEqual(callsAfterRecovery);
  });

  it('logs an error and keeps polling when the write-back fails', async () => {
    // The check passes, but writes still fail.
    probeResult = true;
    await jest.advanceTimersByTimeAsync(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();

    persistence.failInits = false;
    // The failed attempt backs off for 2 ticks before the next real attempt runs.
    await jest.advanceTimersByTimeAsync(1500);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('bounds write-back attempts and logs with backoff at the exact retry schedule', async () => {
    // The check always passes, but the write-back init always fails.
    probeResult = true;
    const testStart = Date.now();
    const timestamps: number[] = [];
    const originalInit = persistence.init.bind(persistence);
    jest.spyOn(persistence, 'init').mockImplementation((allData, callback) => {
      timestamps.push(Date.now() - testStart);
      return originalInit(allData, callback);
    });
    await jest.advanceTimersByTimeAsync(10000);
    // Only the first failure of the outage logs at error level.
    expect(logger.error).toHaveBeenCalledTimes(1);
    // Asserting the exact attempt timestamps, not just the count, catches a
    // boundary regression in the backoff formula that a count-only assertion
    // would miss. Backoff bounds attempts at t=500, 1500, 3500, 7500ms - far
    // below the 20 a fixed 500ms retry would produce over the same window.
    expect(timestamps).toEqual([500, 1500, 3500, 7500]);
  });

  it('recovers through a successful mirrored write even while a probe never answers', async () => {
    // Simulates a hung socket: the probe is invoked but never calls back.
    persistence.isStoreAvailable = () => {
      probeCalls += 1;
    };
    await jest.advanceTimersByTimeAsync(500);
    expect(probeCalls).toEqual(1);

    persistence.failUpserts = false;
    persistence.failInits = false;
    await pollingFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Persistent store is available again.');
  });

  it('does not let a synchronously throwing probe escape the poll timer', async () => {
    let throwProbe = true;
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      if (throwProbe) {
        throw new Error('probe exploded');
      }
      callback(probeResult);
    };

    await expect(jest.advanceTimersByTimeAsync(1000)).resolves.toBeUndefined();
    // Polling was not stranded by the throw.
    expect(probeCalls).toBeGreaterThanOrEqual(2);

    throwProbe = false;
    probeResult = true;
    persistence.failInits = false;
    persistence.failUpserts = false;
    await jest.advanceTimersByTimeAsync(500);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('does not let a synchronously throwing write-back init escape the poll timer', async () => {
    persistence.throwOnInit = true;
    probeResult = true;
    await jest.advanceTimersByTimeAsync(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();

    persistence.throwOnInit = false;
    persistence.failInits = false;
    // The failed attempt backs off for 2 ticks before the next real attempt runs.
    await jest.advanceTimersByTimeAsync(1500);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('does not let a probe that throws a value with no toString escape the poll timer', async () => {
    let throwProbe = true;
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      if (throwProbe) {
        // A null-prototype object has no toString(), so interpolating it directly
        // into a template literal throws.
        throw Object.create(null);
      }
      callback(probeResult);
    };

    await expect(jest.advanceTimersByTimeAsync(1000)).resolves.toBeUndefined();
    // Polling was not stranded by the throw.
    expect(probeCalls).toBeGreaterThanOrEqual(2);

    throwProbe = false;
    probeResult = true;
    persistence.failInits = false;
    persistence.failUpserts = false;
    await jest.advanceTimersByTimeAsync(500);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('produces exactly one write-back when the probe callback is invoked twice', async () => {
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      callback(true);
      callback(true);
    };
    persistence.failInits = false;
    persistence.failUpserts = false;
    const initCallsBefore = persistence.initCalls.length;

    await jest.advanceTimersByTimeAsync(500);

    expect(persistence.initCalls.length - initCallsBefore).toEqual(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('does not start an overlapping check while one is in flight', async () => {
    const pendingCallbacks: ((isAvailable: boolean) => void)[] = [];
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      pendingCallbacks.push(callback);
    };
    await jest.advanceTimersByTimeAsync(2000);
    expect(probeCalls).toEqual(1);
    pendingCallbacks.forEach((cb) => cb(false));
    await jest.advanceTimersByTimeAsync(500);
    expect(probeCalls).toEqual(2);
  });

  it('stops polling when the store is closed', async () => {
    pollingStore.close();
    await jest.advanceTimersByTimeAsync(5000);
    expect(probeCalls).toEqual(0);
  });

  it('does not log or poll for write results after close', async () => {
    // Recover first so the store is available again.
    persistence.failInits = false;
    persistence.failUpserts = false;
    probeResult = true;
    await jest.advanceTimersByTimeAsync(500);
    expect(logger.info).toHaveBeenCalledTimes(1);

    pollingStore.close();
    persistence.failUpserts = true;
    await pollingFacade.applyChanges(
      false,
      { features: { flagC: { version: 2 } } },
      undefined,
      's3',
    );

    // Only the original outage warning was logged, and no new checks run.
    expect(logger.warn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(probeCalls).toEqual(1);
  });

  it('does not let an async-rejecting probe escape as an unhandled rejection', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      let healed = false;
      persistence.isStoreAvailable = ((callback: (isAvailable: boolean) => void) => {
        probeCalls += 1;
        if (!healed) {
          return Promise.reject(new Error('probe rejected'));
        }
        callback(true);
        return undefined;
      }) as unknown as (callback: (isAvailable: boolean) => void) => void;

      await jest.advanceTimersByTimeAsync(1500);
      // The poller kept ticking; the rejection did not strand it.
      expect(probeCalls).toBeGreaterThanOrEqual(2);
      expect(logger.info).not.toHaveBeenCalled();

      healed = true;
      persistence.failInits = false;
      persistence.failUpserts = false;
      await jest.advanceTimersByTimeAsync(500);
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('handles an async-rejecting write-back init as a write-back failure', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      persistence.rejectOnInit = true;
      probeResult = true;
      await jest.advanceTimersByTimeAsync(500);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalled();

      persistence.rejectOnInit = false;
      persistence.failInits = false;
      // The failed attempt embargoes retries for 1000ms before the next real
      // attempt is allowed to run.
      await jest.advanceTimersByTimeAsync(1000);
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('recovers a second outage after a first outage left a hung probe unanswered', async () => {
    // Outage 1 (already underway from beforeEach): the probe is invoked but never
    // answers, simulating a hung socket.
    persistence.isStoreAvailable = () => {
      probeCalls += 1;
    };
    await jest.advanceTimersByTimeAsync(500);
    expect(probeCalls).toEqual(1);

    // Recovery happens through a successful mirrored write instead of the probe.
    persistence.failUpserts = false;
    persistence.failInits = false;
    await pollingFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );
    expect(logger.info).toHaveBeenCalledTimes(1);

    // Outage 2: a healthy probe now answers immediately. If the hung outage-1 probe
    // had left the poller permanently stranded, this outage would see zero probes.
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      callback(true);
    };
    const probeCallsBeforeOutage2 = probeCalls;
    persistence.failUpserts = true;
    await pollingFacade.applyChanges(
      false,
      { features: { flagD: { version: 1 } } },
      undefined,
      's4',
    );
    expect(logger.warn).toHaveBeenCalledTimes(2);

    persistence.failUpserts = false;
    persistence.failInits = false;
    // Outage 1's write-back success armed its own 1s floor embargo, which persists
    // across the transition, so wait past it before expecting outage 2 to probe.
    await jest.advanceTimersByTimeAsync(1500);
    expect(probeCalls).toBeGreaterThan(probeCallsBeforeOutage2);
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('releases a hung write-back after its deadline and retries', async () => {
    persistence.deferInit = true;
    probeResult = true;
    await jest.advanceTimersByTimeAsync(500);
    expect(persistence.pendingInitCallbacks.length).toEqual(1);
    const staleCallback = persistence.pendingInitCallbacks[0];

    persistence.deferInit = false;
    persistence.failInits = false;
    persistence.failUpserts = false;
    // Advance past the 30 second hung write-back deadline. The probe keeps
    // answering true every tick, but the poller must not retry until the
    // outstanding write-back is treated as abandoned. Releasing it also arms a
    // 1 second failure embargo, so the retry lands just after the deadline, not
    // exactly on it.
    await jest.advanceTimersByTimeAsync(31500);
    expect(logger.info).toHaveBeenCalledTimes(1);

    const initCallsAfterRecovery = persistence.initCalls.length;
    const logInfoCallsAfterRecovery = (logger.info as jest.Mock).mock.calls.length;
    // The original, now-abandoned write-back finally calls back. It must be ignored.
    staleCallback();
    expect(persistence.initCalls.length).toEqual(initCallsAfterRecovery);
    expect((logger.info as jest.Mock).mock.calls.length).toEqual(logInfoCallsAfterRecovery);
  });

  it('logs at error level for the first genuine write-back failure even when the outage started with a hung write-back', async () => {
    persistence.deferInit = true;
    probeResult = true;
    await jest.advanceTimersByTimeAsync(500);
    expect(persistence.pendingInitCallbacks.length).toEqual(1);

    // Advance past the 30 second hung write-back deadline (releasing it, which logs
    // only at debug level and arms a failure embargo) and past that embargo, so a
    // fresh, non-hung write-back attempt runs and genuinely fails. This must still
    // be the outage's first ERROR-level log: the hung release must not have
    // consumed it.
    persistence.deferInit = false;
    await jest.advanceTimersByTimeAsync(31500);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();

    // A later write-back failure in the same outage logs at debug level only.
    await jest.advanceTimersByTimeAsync(2000);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('bounds write-back attempts triggered by successful writes to the embargo schedule', async () => {
    // Keep the poller out of this test entirely; only the write-signal path matters.
    probeResult = false;
    persistence.failUpserts = false;
    persistence.failInits = true;
    const initCallsBefore = persistence.initCalls.length;

    // 10 consecutive successful mirrored writes, with no time passing between them.
    await Array.from({ length: 10 }, (_, i) => i).reduce(
      (previous, i) =>
        previous.then(() =>
          pollingFacade.applyChanges(
            false,
            { features: { [`flag${i}`]: { version: 1 } } },
            undefined,
            `s${i}`,
          ),
        ),
      Promise.resolve(),
    );

    // Every successful write signals recovery, but the embargo armed by the first
    // attempt's failure blocks the other 9 since no time passed.
    expect(persistence.initCalls.length - initCallsBefore).toEqual(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('recovers directly from a successful basis write during an outage without a redundant write-back', async () => {
    probeResult = false;
    persistence.failInits = false;
    const initCallsBefore = persistence.initCalls.length;

    await pollingFacade.applyChanges(
      true,
      { features: { flagE: { key: 'flagE', version: 9 } } },
      undefined,
      's-basis',
    );

    // Only the basis write itself happened; no separate write-back was issued for
    // the identical payload.
    expect(persistence.initCalls.length - initCallsBefore).toEqual(1);
    expect(persistence.initCalls[persistence.initCalls.length - 1]).toEqual({
      features: { flagE: { key: 'flagE', version: 9 } },
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale tick-1 probe answer that arrives after tick-2 issued a new probe', async () => {
    const callbacks: ((isAvailable: boolean) => void)[] = [];
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      callbacks.push(callback);
      if (probeCalls === 1) {
        // Tick 1 answers immediately, like a normal probe.
        callback(false);
      }
      // Tick 2's probe intentionally does not answer here; the test answers it
      // manually below, after replaying tick 1's stale callback.
    };

    await jest.advanceTimersByTimeAsync(500); // tick 1: answers false immediately
    await jest.advanceTimersByTimeAsync(500); // tick 2: issues a new probe, pending
    expect(probeCalls).toEqual(2);

    // Tick 1's callback fires again (a double-invocation bug in the probe), falsely
    // claiming the store is available. It must not trigger recovery.
    callbacks[0](true);
    expect(logger.info).not.toHaveBeenCalled();

    // Tick 2's real, current answer is honored.
    persistence.failInits = false;
    persistence.failUpserts = false;
    callbacks[1](true);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale probe answer that arrives after write-signal recovery already completed', async () => {
    let pendingCallback: ((isAvailable: boolean) => void) | undefined;
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      pendingCallback = callback;
    };
    await jest.advanceTimersByTimeAsync(500);
    expect(probeCalls).toEqual(1);

    persistence.failUpserts = false;
    persistence.failInits = false;
    await pollingFacade.applyChanges(
      false,
      { features: { flagC: { version: 1 } } },
      undefined,
      's3',
    );
    expect(logger.info).toHaveBeenCalledTimes(1);

    const initCallsAfterRecovery = persistence.initCalls.length;
    pendingCallback?.(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(persistence.initCalls.length).toEqual(initCallsAfterRecovery);
  });

  it('bounds write-backs from a flapping store to the 1 second success embargo floor', async () => {
    probeResult = false;
    persistence.failInits = false;
    const initCallsBefore = persistence.initCalls.length;

    await Array.from({ length: 20 }, (_, i) => i).reduce(
      (previous, i) =>
        previous.then(async () => {
          persistence.failUpserts = i % 2 === 0;
          await pollingFacade.applyChanges(
            false,
            { features: { [`flag${i}`]: { version: 1 } } },
            undefined,
            `s${i}`,
          );
          // 100ms between writes; 20 cycles span 2000ms of wall-clock time.
          await jest.advanceTimersByTimeAsync(100);
        }),
      Promise.resolve(),
    );

    // Without the 1 second floor, this would produce 10 write-backs (one per
    // successful write, at i=1,3,5,...,19). With it, only the successful writes at
    // t=100ms and t=1100ms fall outside the still-armed embargo from the previous
    // write-back, so exactly 2 attempts are made over the 2 second window.
    expect(persistence.initCalls.length - initCallsBefore).toEqual(2);
  });

  it('ignores a write-back that settles after a stale generation from a prior outage', async () => {
    // Outage 1 is already underway from beforeEach (flagB's upsert failed). Issue a
    // write-back for it and leave it pending.
    persistence.deferInit = true;
    persistence.failUpserts = false;
    await pollingFacade.applyChanges(
      false,
      { features: { flagX: { version: 1 } } },
      undefined,
      's-outage1-writeback',
    );
    expect(persistence.pendingInitCallbacks.length).toEqual(1);
    const staleWriteBack = persistence.pendingInitCallbacks[0];

    // Recovery happens through a direct basis write (the shortcut path), not
    // through the pending write-back.
    persistence.deferInit = false;
    persistence.failInits = false;
    await pollingFacade.applyChanges(
      true,
      { features: { flagA: { key: 'flagA', version: 2 } } },
      undefined,
      'selector-outage1-recovery',
    );
    expect(logger.info).toHaveBeenCalledTimes(1);

    // Outage 2 begins.
    persistence.failUpserts = true;
    await pollingFacade.applyChanges(
      false,
      { features: { flagY: { version: 1 } } },
      undefined,
      's-outage2',
    );
    expect(logger.warn).toHaveBeenCalledTimes(2);

    // The stale outage-1 write-back finally settles successfully. Its generation
    // is long gone, so it must be ignored.
    staleWriteBack();
    expect(logger.info).toHaveBeenCalledTimes(1);

    // A genuine write-back failure in outage 2 must log at error level, proving
    // the counter/log gate was not left contaminated by the ignored settle. This
    // also proves the store is still unavailable: if the stale settle had
    // incorrectly recovered it, _attemptRecovery() would have returned early and
    // no write-back (and so no failure) would have been attempted here.
    persistence.failUpserts = false;
    persistence.failInits = true;
    await pollingFacade.applyChanges(
      false,
      { features: { flagZ: { version: 1 } } },
      undefined,
      's-outage2-writeback',
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('releases a hung probe after its deadline and issues a fresh one', async () => {
    const pendingCallbacks: ((isAvailable: boolean) => void)[] = [];
    persistence.isStoreAvailable = (callback: (isAvailable: boolean) => void) => {
      probeCalls += 1;
      pendingCallbacks.push(callback);
    };
    await jest.advanceTimersByTimeAsync(500);
    expect(probeCalls).toEqual(1);
    const staleProbe = pendingCallbacks[0];

    // Advance past the 30 second hung probe deadline. A fresh probe must be issued.
    await jest.advanceTimersByTimeAsync(30000);
    expect(probeCalls).toBeGreaterThan(1);

    persistence.failInits = false;
    persistence.failUpserts = false;
    pendingCallbacks[pendingCallbacks.length - 1](true);
    expect(logger.info).toHaveBeenCalledTimes(1);

    // The stale probe's late answer must be ignored.
    const infoCallsAfterRecovery = (logger.info as jest.Mock).mock.calls.length;
    staleProbe(true);
    expect((logger.info as jest.Mock).mock.calls.length).toEqual(infoCallsAfterRecovery);
  });

  it('bounds retries against a write-back that never answers to the deadline-plus-embargo schedule', async () => {
    // The check always passes, but the write-back init never calls back.
    probeResult = true;
    persistence.deferInit = true;
    const initCallsBefore = persistence.initCalls.length;

    await jest.advanceTimersByTimeAsync(100000);

    // Each cycle is the 30 second hung deadline plus the exponential embargo the
    // release arms, not a fixed 500ms retry (which would produce 200 attempts over
    // this window). Value confirmed against the actual schedule produced by the
    // implementation.
    expect(persistence.initCalls.length - initCallsBefore).toEqual(4);
  });

  it('clears an accumulated failure embargo when a basis write recovers the store directly', async () => {
    // The check always passes, but the write-back init always fails, building the
    // backoff embargo up over the outage until it is pinned near its 30 second cap.
    probeResult = true;
    await jest.advanceTimersByTimeAsync(32000);

    // Recover directly via a basis write (the shortcut path), not through a
    // write-back.
    persistence.failInits = false;
    persistence.failUpserts = false;
    await pollingFacade.applyChanges(
      true,
      { features: { flagA: { key: 'flagA', version: 2 } } },
      undefined,
      'selector-recovery',
    );
    expect(logger.info).toHaveBeenCalledTimes(1);

    // Outage 2 begins.
    persistence.failUpserts = true;
    await pollingFacade.applyChanges(
      false,
      { features: { flagE: { version: 1 } } },
      undefined,
      's-outage2',
    );
    expect(logger.warn).toHaveBeenCalledTimes(2);

    // The first write-back of outage 2 must be allowed well within the 1500ms
    // window below, not held back by the 30 second embargo accumulated in outage 1.
    persistence.failUpserts = false;
    const initCallsBefore = persistence.initCalls.length;
    await jest.advanceTimersByTimeAsync(1500);
    expect(persistence.initCalls.length).toBeGreaterThan(initCallsBefore);
  });

  it('does not log after close for a probe rejection that arrives late', async () => {
    let rejectProbe: (() => void) | undefined;
    persistence.isStoreAvailable = (() =>
      new Promise((_resolve, reject) => {
        rejectProbe = () => reject(new Error('late rejection'));
      })) as unknown as (callback: (isAvailable: boolean) => void) => void;

    await jest.advanceTimersByTimeAsync(500);
    expect(rejectProbe).toBeDefined();

    pollingStore.close();
    const debugCallsBeforeReject = (logger.debug as jest.Mock).mock.calls.length;
    rejectProbe!();
    await jest.advanceTimersByTimeAsync(0);
    expect((logger.debug as jest.Mock).mock.calls.length).toEqual(debugCallsBeforeReject);
  });

  it('does not crash when a rejection reason cannot be converted to a string', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      persistence.isStoreAvailable = (() => Promise.reject(Object.create(null))) as unknown as (
        callback: (isAvailable: boolean) => void,
      ) => void;
      await jest.advanceTimersByTimeAsync(500);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});

it('does not schedule availability checks when the persistence store has no check', async () => {
  jest.useFakeTimers();
  try {
    const persistence = new MockPersistenceStore();
    const logger = makeLogger();
    const store = new TransactionalFeatureStore(persistence, logger);
    const facade = new AsyncTransactionalStoreFacade(store);
    await facade.applyChanges(true, { features: {} }, undefined, 's1');
    persistence.failUpserts = true;
    await facade.applyChanges(false, { features: { flagB: { version: 1 } } }, undefined, 's2');
    expect(jest.getTimerCount()).toEqual(0);
    store.close();
  } finally {
    jest.useRealTimers();
  }
});
