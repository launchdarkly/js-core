import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
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

  it('does not mirror a basis with a false persist indicator to the persistence store', async () => {
    // Situate data in the persistence store, so the test can tell a mirrored basis from
    // a suppressed one.
    await nonTransactionalFacade.init({
      features: {
        persistedFeature: {
          version: 1,
        },
      },
    });
    const initSpy = jest.spyOn(mockNontransactionalStore, 'init');

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
      false,
    );

    // The persistence store keeps its own data. The basis did not reach it.
    expect(initSpy).not.toHaveBeenCalled();
    expect(await nonTransactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      persistedFeature: {
        version: 1,
      },
    });

    // The memory store holds the basis, and it is the active store for reads.
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });
  });

  it('does not mirror a change with a false persist indicator to the persistence store', async () => {
    // Apply a basis first, so later changes are ordinary upserts.
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
    const upsertSpy = jest.spyOn(mockNontransactionalStore, 'upsert');

    await transactionalFacade.applyChanges(
      false,
      {
        features: {
          key2: {
            version: 1,
          },
        },
      },
      undefined,
      'selector2',
      false,
    );

    // The change did not reach the persistence store, and the memory store holds it.
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
      key2: {
        key: 'key2',
        version: 1,
      },
    });
  });
});

describe('given a persistent store that records its calls', () => {
  // A persistent store that records each init, counts cache drops, fails
  // upserts on demand, and answers availability checks on demand.
  function makeRecordingStore() {
    const initCalls: LDFeatureStoreDataStorage[] = [];
    const dropCache = jest.fn();
    let failUpserts = false;
    let storeAvailable = true;
    const store: LDFeatureStore = {
      init: (allData, callback) => {
        initCalls.push(allData);
        callback();
      },
      get: (_kind, _key, callback) => callback(null),
      all: (_kind, callback) => callback({}),
      upsert: (_kind, _data, callback) => {
        if (failUpserts) {
          callback(new Error('store write failed'));
          return;
        }
        callback();
      },
      delete: (_kind, _key, _version, callback) => callback(),
      initialized: (callback) => callback(false),
      isStoreAvailable: (callback) => callback(storeAvailable),
      dropCache,
      close: () => {},
    };
    return {
      store,
      initCalls,
      dropCache,
      setFailUpserts: (value: boolean) => {
        failUpserts = value;
      },
      setStoreAvailable: (value: boolean) => {
        storeAvailable = value;
      },
    };
  }

  it('does not write suppressed data back to the persistent store during recovery', async () => {
    jest.useFakeTimers();
    const recording = makeRecordingStore();
    const transactionalStore = new TransactionalFeatureStore(recording.store);
    const facade = new AsyncTransactionalStoreFacade(transactionalStore);
    try {
      await facade.applyChanges(
        true,
        { features: { basisFlag: { version: 1 } } },
        undefined,
        'selector-1',
      );

      // A failed mirrored write marks the persistence store unavailable, and the
      // availability poll starts.
      recording.setFailUpserts(true);
      recording.setStoreAvailable(false);
      await facade.applyChanges(
        false,
        { features: { failedFlag: { version: 1 } } },
        undefined,
        'selector-2',
      );

      // The suppressed change is the latest persist indicator the store holds.
      await facade.applyChanges(
        false,
        { features: { suppressedFlag: { version: 1 } } },
        undefined,
        'selector-3',
        false,
      );

      // The store answers the availability check. The latest indicator is
      // false, so recovery completes without a write-back: the persistence
      // store keeps only the data of the original basis.
      recording.setStoreAvailable(true);
      jest.advanceTimersByTime(600);

      expect(recording.initCalls).toHaveLength(1);
      expect(await facade.all(VersionedDataKinds.Features)).toHaveProperty('suppressedFlag');
      expect(await facade.all(VersionedDataKinds.Features)).toHaveProperty('failedFlag');
    } finally {
      facade.close();
      jest.useRealTimers();
    }
  });

  it('drops the persistent store cache for a basis that is not mirrored', async () => {
    const recording = makeRecordingStore();
    const transactionalStore = new TransactionalFeatureStore(recording.store);
    const facade = new AsyncTransactionalStoreFacade(transactionalStore);
    try {
      await facade.applyChanges(
        true,
        { features: { key1: { version: 1 } } },
        undefined,
        'selector-1',
        false,
      );

      // The memory store is the source of truth now, so the persistent store
      // drops its cache, but the basis itself does not reach it.
      expect(recording.dropCache).toHaveBeenCalledTimes(1);
      expect(recording.initCalls).toHaveLength(0);
    } finally {
      facade.close();
    }
  });

  it('drops the persistent store cache for a mirrored basis as well', async () => {
    const recording = makeRecordingStore();
    const transactionalStore = new TransactionalFeatureStore(recording.store);
    const facade = new AsyncTransactionalStoreFacade(transactionalStore);
    try {
      await facade.applyChanges(
        true,
        { features: { key1: { version: 1 } } },
        undefined,
        'selector-1',
      );

      expect(recording.dropCache).toHaveBeenCalledTimes(1);
      expect(recording.initCalls).toHaveLength(1);
    } finally {
      facade.close();
    }
  });
});
