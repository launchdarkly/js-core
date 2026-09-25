import { DefaultBackoff, LDLogger } from '@launchdarkly/js-sdk-common';

import {
  DataKind,
  PersistentDataStore,
  PersistentStoreDataKind,
  SerializedItemDescriptor,
} from '../../src/api/interfaces';
import KeyedItem from '../../src/api/interfaces/persistent_store/KeyedItem';
import { KindKeyedStore } from '../../src/api/interfaces/persistent_store/PersistentDataStore';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../../src/api/subsystems';
import AsyncTransactionalStoreFacade from '../../src/store/AsyncTransactionalStoreFacade';
import PersistentDataStoreWrapper from '../../src/store/PersistentDataStoreWrapper';
import TransactionalFeatureStore from '../../src/store/TransactionalFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

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

  // Calls the init() callback with success and then also returns a rejected promise.
  // Simulates a persistence client that answers through two channels.
  rejectAfterInitCallback = false;

  // Calls the upsert() callback with success and then also throws synchronously.
  // Simulates a persistence client that answers through two channels.
  throwAfterUpsertCallback = false;

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
    if (this.rejectAfterInitCallback) {
      callback(undefined);
      // Cast needed: same as rejectOnInit above.
      return Promise.reject(new Error('init rejected after callback')) as unknown as void;
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
    if (this.throwAfterUpsertCallback) {
      callback(undefined);
      throw new Error('upsert exploded after callback');
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

// The production backoff jitters its delays. Tests inject this jitter-free variant so
// timer advances stay exact: 1000ms after the first failure, then 2000, 4000, and so on.
function deterministicBackoff(): DefaultBackoff {
  return new DefaultBackoff(1000, 30000, () => 0);
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
    recoveryStore = new TransactionalFeatureStore(persistence, logger, deterministicBackoff());
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

  it('retries at the embargo deadline a recovery signal that arrived during the embargo', async () => {
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

      // A successful mirrored write triggers a write-back, which fails and embargoes
      // retries for 1000ms.
      persistence.failUpserts = false;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );
      expect(logger.error).toHaveBeenCalledTimes(1);

      // A final mirrored write succeeds inside the embargo. No writes follow it.
      persistence.failInits = false;
      await jest.advanceTimersByTimeAsync(500);
      await recoveryFacade.applyChanges(
        false,
        { features: { flagD: { version: 1 } } },
        undefined,
        's4',
      );
      expect(logger.info).not.toHaveBeenCalled();

      // The kept signal runs at the embargo deadline and recovers the store.
      await jest.advanceTimersByTimeAsync(500);
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Persistent store is available again.');
      expect(persistence.initCalls[persistence.initCalls.length - 1]).toEqual({
        features: {
          flagA: { key: 'flagA', version: 2, deleted: true },
          flagB: { key: 'flagB', version: 1 },
          flagC: { key: 'flagC', version: 1 },
          flagD: { key: 'flagD', version: 1 },
        },
        segments: {},
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs at most one write-back for several signals inside the same embargo', async () => {
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
      persistence.failUpserts = false;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );

      persistence.failInits = false;
      const initCallsBefore = persistence.initCalls.length;
      await jest.advanceTimersByTimeAsync(300);
      await recoveryFacade.applyChanges(
        false,
        { features: { flagD: { version: 1 } } },
        undefined,
        's4',
      );
      await recoveryFacade.applyChanges(
        false,
        { features: { flagE: { version: 1 } } },
        undefined,
        's5',
      );

      await jest.advanceTimersByTimeAsync(700);
      expect(persistence.initCalls.length).toEqual(initCallsBefore + 1);
      expect(logger.info).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not run an embargoed recovery signal after close', async () => {
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
      persistence.failUpserts = false;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );

      // A signal inside the embargo schedules the retry, then the store closes
      // before the embargo deadline.
      persistence.failInits = false;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagD: { version: 1 } } },
        undefined,
        's4',
      );
      expect(jest.getTimerCount()).toEqual(1);
      const initCallsBefore = persistence.initCalls.length;
      recoveryStore.close();
      // Close cancels the retry timer, so it cannot keep the process alive.
      expect(jest.getTimerCount()).toEqual(0);

      await jest.advanceTimersByTimeAsync(5000);
      expect(persistence.initCalls.length).toEqual(initCallsBefore);
      expect(logger.info).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries a failed write-back at the backoff deadline without a new write', async () => {
    jest.useFakeTimers();
    try {
      persistence.failUpserts = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagB: { version: 1 } } },
        undefined,
        's2',
      );

      // A recovery signal starts a write-back, which fails.
      persistence.failUpserts = false;
      persistence.failInits = true;
      const initCallsBefore = persistence.initCalls.length;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );
      expect(persistence.initCalls.length - initCallsBefore).toEqual(1);
      expect(logger.error).toHaveBeenCalledTimes(1);

      // No further mirrored writes arrive. The retry runs at the backoff deadline.
      persistence.failInits = false;
      await jest.advanceTimersByTimeAsync(1000);
      expect(persistence.initCalls.length - initCallsBefore).toEqual(2);
      expect(logger.info).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not mark the store recovered when a mirrored write fails during an in-flight write-back', async () => {
    jest.useFakeTimers();
    try {
      persistence.failUpserts = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagB: { version: 1 } } },
        undefined,
        's2',
      );

      // A recovery signal starts a write-back, held open.
      persistence.failUpserts = false;
      persistence.deferInit = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );
      expect(persistence.pendingInitCallbacks.length).toEqual(1);

      // A newer mirrored write fails while that write-back is in flight.
      persistence.failUpserts = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagD: { version: 1 } } },
        undefined,
        's4',
      );

      // The write-back completes successfully, but its snapshot predates flagD.
      persistence.deferInit = false;
      persistence.failUpserts = false;
      persistence.pendingInitCallbacks[0]();
      expect(logger.info).not.toHaveBeenCalled();

      // Another write-back runs after the flap embargo, with the current data.
      const initCallsBefore = persistence.initCalls.length;
      await jest.advanceTimersByTimeAsync(1000);
      expect(persistence.initCalls.length - initCallsBefore).toEqual(1);
      const lastInit = persistence.initCalls[persistence.initCalls.length - 1];
      expect(lastInit.features.flagD).toEqual({ key: 'flagD', version: 1 });
      expect(logger.info).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('releases a hung write-back at its deadline for a store without an availability check', async () => {
    jest.useFakeTimers();
    try {
      persistence.failUpserts = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagB: { version: 1 } } },
        undefined,
        's2',
      );

      // A recovery signal starts a write-back, which hangs.
      persistence.failUpserts = false;
      persistence.deferInit = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );
      expect(persistence.pendingInitCallbacks.length).toEqual(1);

      // No further writes arrive. The deadline releases the hung write-back, the
      // backoff passes, and the retry succeeds.
      persistence.deferInit = false;
      const initCallsBefore = persistence.initCalls.length;
      await jest.advanceTimersByTimeAsync(30000);
      await jest.advanceTimersByTimeAsync(1000);
      expect(persistence.initCalls.length - initCallsBefore).toEqual(1);
      expect(logger.info).toHaveBeenCalledTimes(1);

      // The abandoned write-back's late settle is ignored.
      persistence.pendingInitCallbacks[0]();
      expect(logger.info).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rate-limits the next write-back after a basis write recovers the store', async () => {
    jest.useFakeTimers();
    try {
      persistence.failUpserts = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagB: { version: 1 } } },
        undefined,
        's2',
      );

      // A basis write recovers the store directly.
      persistence.failUpserts = false;
      await recoveryFacade.applyChanges(
        true,
        { features: { flagA: { key: 'flagA', version: 3 } } },
        undefined,
        's3',
      );
      expect(logger.info).toHaveBeenCalledTimes(1);

      // A new outage and a recovery signal arrive right after the recovery.
      persistence.failUpserts = true;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's4',
      );
      persistence.failUpserts = false;
      const initCallsBefore = persistence.initCalls.length;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagD: { version: 1 } } },
        undefined,
        's5',
      );

      // The flap embargo from the basis recovery defers the write-back.
      expect(persistence.initCalls.length - initCallsBefore).toEqual(0);
      await jest.advanceTimersByTimeAsync(1000);
      expect(persistence.initCalls.length - initCallsBefore).toEqual(1);
      expect(logger.info).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels the embargoed recovery signal when a basis write recovers the store first', async () => {
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
      persistence.failUpserts = false;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagC: { version: 1 } } },
        undefined,
        's3',
      );

      // A signal inside the embargo schedules the retry, then a basis write
      // recovers the store directly before the embargo deadline.
      persistence.failInits = false;
      await recoveryFacade.applyChanges(
        false,
        { features: { flagD: { version: 1 } } },
        undefined,
        's4',
      );
      expect(jest.getTimerCount()).toEqual(1);
      await recoveryFacade.applyChanges(
        true,
        { features: { flagE: { version: 1 } }, segments: {} },
        undefined,
        's5',
      );
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toEqual(0);
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

  it('ignores a rejected init promise when the basis write already answered through its callback', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      persistence.rejectAfterInitCallback = true;
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
      // The callback answered success first, so the late rejection must not
      // report a write failure.
      expect(logger.warn).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('ignores a synchronous throw when the mirrored upsert already answered through its callback', async () => {
    persistence.throwAfterUpsertCallback = true;
    let callbackCalls = 0;
    await new Promise<void>((resolve) => {
      recoveryStore.upsert(VersionedDataKinds.Features, { key: 'flagB', version: 1 }, () => {
        callbackCalls += 1;
        resolve();
      });
    });
    await Promise.resolve();
    expect(callbackCalls).toEqual(1);
    // The callback answered success first, so the late throw must not report
    // a write failure.
    expect(logger.warn).not.toHaveBeenCalled();
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
    pollingStore = new TransactionalFeatureStore(persistence, logger, deterministicBackoff());
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
    // the log gate was not left contaminated by the ignored settle. This also
    // proves the store is still unavailable: if the stale settle had incorrectly
    // recovered it, _attemptRecovery() would have returned early and no write-back
    // (and so no failure) would have been attempted here. The basis recovery armed
    // the flap embargo, so the signal defers to a poll tick past the embargo.
    persistence.failUpserts = false;
    persistence.failInits = true;
    await pollingFacade.applyChanges(
      false,
      { features: { flagZ: { version: 1 } } },
      undefined,
      's-outage2-writeback',
    );
    probeResult = true;
    await jest.advanceTimersByTimeAsync(1000);
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

type RecordedOp =
  | { type: 'init'; allData: KindKeyedStore<PersistentStoreDataKind> }
  | { type: 'upsert'; namespace: string; key: string; descriptor: SerializedItemDescriptor };

// Models the core of a real PersistentDataStoreWrapper, the way MockPersistentStore does in
// PersistentStoreWrapper.test.ts, but also records every operation it receives (in order) so
// a test can assert on ordering, not just final state.
class RecordingPersistentStore implements PersistentDataStore {
  allData: KindKeyedStore<PersistentStoreDataKind> = [];

  ops: RecordedOp[] = [];

  failInits = false;

  failUpserts = false;

  // Defers the init() callback instead of invoking it, so a test can hold a write-back
  // attempt open while driving a concurrent update through the wrapper's queue.
  deferInit = false;

  pendingInitCallbacks: (() => void)[] = [];

  isStoreAvailable?: (callback: (isAvailable: boolean) => void) => void;

  init(allData: KindKeyedStore<PersistentStoreDataKind>, callback: (err?: Error) => void): void {
    this.ops.push({ type: 'init', allData });
    const settle = () => {
      if (this.failInits) {
        callback(new Error('init failed'));
        return;
      }
      this.allData = allData;
      callback();
    };
    if (this.deferInit) {
      this.pendingInitCallbacks.push(settle);
      return;
    }
    settle();
  }

  get(
    kind: PersistentStoreDataKind,
    key: string,
    callback: (descriptor: SerializedItemDescriptor | undefined) => void,
  ): void {
    const itemsForKind = this.allData.find((kvp) => kvp.key.namespace === kind.namespace)?.item;
    callback(itemsForKind?.find((kvp) => kvp.key === key)?.item ?? undefined);
  }

  getAll(
    kind: PersistentStoreDataKind,
    callback: (descriptors: KeyedItem<string, SerializedItemDescriptor>[] | undefined) => void,
  ): void {
    callback(this.allData.find((kvp) => kvp.key.namespace === kind.namespace)?.item);
  }

  upsert(
    kind: PersistentStoreDataKind,
    key: string,
    descriptor: SerializedItemDescriptor,
    callback: (err?: Error, updatedDescriptor?: SerializedItemDescriptor) => void,
  ): void {
    this.ops.push({ type: 'upsert', namespace: kind.namespace, key, descriptor });
    if (this.failUpserts) {
      callback(new Error('upsert failed'));
      return;
    }
    let kindEntry = this.allData.find((kvp) => kvp.key.namespace === kind.namespace);
    if (!kindEntry) {
      kindEntry = { key: kind, item: [] };
      this.allData.push(kindEntry);
    }
    const slot = kindEntry.item.find((kvp) => kvp.key === key);
    if (slot) {
      slot.item = descriptor;
    } else {
      kindEntry.item.push({ key, item: descriptor });
    }
    callback(undefined, descriptor);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    callback(true);
  }

  close(): void {}

  getDescription(): string {
    return 'recording persistence store';
  }
}

it('captures a snapshot of a key before a concurrent newer write to that key reaches persistence', async () => {
  const persistence = new MockPersistenceStore();
  const logger = makeLogger();
  const store = new TransactionalFeatureStore(persistence, logger);
  const facade = new AsyncTransactionalStoreFacade(store);
  try {
    await facade.applyChanges(
      true,
      { features: { flagA: { key: 'flagA', version: 1 } } },
      undefined,
      'basis',
    );

    persistence.failUpserts = true;
    await facade.applyChanges(false, { features: { flagB: { version: 1 } } }, undefined, 's2');
    expect(logger.warn).toHaveBeenCalledTimes(1);

    persistence.failUpserts = false;
    const initCallsBeforeRecovery = persistence.initCalls.length;
    const upsertCallsBeforeRecovery = persistence.upsertCalls.length;

    // Trigger recovery with a successful mirrored write, and wait only for that write's own
    // callback: by the time it fires, the write-back it triggered has already run to
    // completion, since both happen synchronously in the same chain, with nothing in between
    // that could let a newer write for the same key land first.
    let recoveryCallbackCalls = 0;
    await new Promise<void>((resolve) => {
      store.upsert(VersionedDataKinds.Features, { key: 'flagC', version: 1 }, () => {
        recoveryCallbackCalls += 1;
        resolve();
      });
    });

    expect(persistence.initCalls.length).toEqual(initCallsBeforeRecovery + 1);
    // Only flagC's own mirrored write has reached persistence so far - the recovery trigger
    // itself. flagA's newer write below has not been issued yet.
    expect(persistence.upsertCalls.length).toEqual(upsertCallsBeforeRecovery + 1);
    const writeBack = persistence.initCalls[persistence.initCalls.length - 1];
    // The write-back's snapshot was taken before the newer write below was ever issued.
    expect(writeBack.features.flagA).toEqual({ key: 'flagA', version: 1 });

    // Immediately apply a newer version of flagA, in the very next statement.
    let deltaCallbackCalls = 0;
    await new Promise<void>((resolve) => {
      store.upsert(VersionedDataKinds.Features, { key: 'flagA', version: 5 }, () => {
        deltaCallbackCalls += 1;
        resolve();
      });
    });

    // The newer write's own mirrored upsert reached persistence only after the write-back.
    expect(persistence.initCalls.length).toEqual(initCallsBeforeRecovery + 1);
    expect(persistence.upsertCalls[persistence.upsertCalls.length - 1]).toEqual({
      key: 'flagA',
      version: 5,
    });

    expect(recoveryCallbackCalls).toEqual(1);
    expect(deltaCallbackCalls).toEqual(1);
  } finally {
    store.close();
  }
});

describe('given a transactional store composed over the real persistent store wrapper', () => {
  let core: RecordingPersistentStore;
  let probeAvailable: boolean;
  let logger: LDLogger;
  let wrapper: PersistentDataStoreWrapper;
  let store: TransactionalFeatureStore;

  beforeEach(() => {
    jest.useFakeTimers();
    core = new RecordingPersistentStore();
    probeAvailable = false;
    core.isStoreAvailable = (callback) => callback(probeAvailable);
    logger = makeLogger();
    wrapper = new PersistentDataStoreWrapper(core, 0, logger);
    store = new TransactionalFeatureStore(wrapper, logger);
  });

  afterEach(() => {
    store.close();
    jest.useRealTimers();
  });

  it('queues writes behind an in-flight full write in order', async () => {
    core.deferInit = true;
    store.applyChanges(
      true,
      { features: { flagA: { key: 'flagA', version: 1 } } },
      () => {},
      undefined,
      'basis',
    );
    expect(core.ops.map((op) => op.type)).toEqual(['init']);

    let upsertCallbackCalls = 0;
    const upsertDone = new Promise<void>((resolve) => {
      store.upsert(VersionedDataKinds.Features, { key: 'flagB', version: 1 }, () => {
        upsertCallbackCalls += 1;
        resolve();
      });
    });
    await jest.advanceTimersByTimeAsync(0);

    // The upsert is queued behind the in-flight init; it has not reached the core yet.
    expect(core.ops.map((op) => op.type)).toEqual(['init']);

    const pendingInit = core.pendingInitCallbacks.slice();
    core.pendingInitCallbacks = [];
    pendingInit.forEach((settle) => settle());

    await jest.advanceTimersByTimeAsync(0);
    await upsertDone;

    expect(core.ops.map((op) => op.type)).toEqual(['init', 'upsert']);
    expect(upsertCallbackCalls).toEqual(1);
  });

  it('recovers through the full persistence chain and writes back a tombstone for a flag deleted during the outage', async () => {
    const facade = new AsyncTransactionalStoreFacade(store);
    await facade.applyChanges(
      true,
      {
        features: {
          flagA: { key: 'flagA', version: 1 },
          flagB: { key: 'flagB', version: 1 },
        },
        segments: {},
      },
      undefined,
      'basis',
    );
    expect(core.ops.filter((op) => op.type === 'init')).toHaveLength(1);

    core.failUpserts = true;
    await facade.applyChanges(false, { features: { flagC: { version: 1 } } }, undefined, 's2');
    expect(logger.warn).toHaveBeenCalledTimes(1);

    // Delete flagB during the outage, so the memory store holds a tombstone for it.
    await facade.delete(VersionedDataKinds.Features, 'flagB', 2);

    await jest.advanceTimersByTimeAsync(500);
    expect(logger.info).not.toHaveBeenCalled();

    probeAvailable = true;
    core.failUpserts = false;
    await jest.advanceTimersByTimeAsync(500);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Persistent store is available again.');
    expect(logger.warn).toHaveBeenCalledTimes(1);

    const featuresEntry = core.allData.find(
      (kvp) => kvp.key.namespace === VersionedDataKinds.Features.namespace,
    );
    expect(featuresEntry?.item.map((kvp) => kvp.key)).toEqual(
      expect.arrayContaining(['flagA', 'flagB', 'flagC']),
    );

    const flagBSlot = featuresEntry?.item.find((kvp) => kvp.key === 'flagB');
    expect(flagBSlot?.item.deleted).toBe(true);
    expect(flagBSlot?.item.serializedItem).toContain('"deleted":true');

    const flagASlot = featuresEntry?.item.find((kvp) => kvp.key === 'flagA');
    expect(flagASlot?.item.deleted).toBeFalsy();
  });
});
