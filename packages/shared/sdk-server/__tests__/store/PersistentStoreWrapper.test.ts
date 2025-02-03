import {
  PersistentDataStore,
  PersistentStoreDataKind,
  SerializedItemDescriptor,
} from '../../src/api/interfaces';
import KeyedItem from '../../src/api/interfaces/persistent_store/KeyedItem';
import { KindKeyedStore } from '../../src/api/interfaces/persistent_store/PersistentDataStore';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import PersistentDataStoreWrapper from '../../src/store/PersistentDataStoreWrapper';
import { persistentStoreKinds } from '../../src/store/persistentStoreKinds';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

/**
 * Conditionally skip tests. Allows conditional tests within an describe.each.
 * @param condition The condition to check.
 * @returns Either `it` or `it.skip` depending on the condition.
 */
const itif = (condition: boolean) => (condition ? it : it.skip);

class MockPersistentStore implements PersistentDataStore {
  allData: KindKeyedStore<PersistentStoreDataKind> | undefined;

  isInitialized = false;

  closed = false;

  init(allData: KindKeyedStore<PersistentStoreDataKind>, callback: () => void): void {
    this.allData = allData;
    this.isInitialized = true;
    callback();
  }

  get(
    kind: PersistentStoreDataKind,
    key: string,
    callback: (descriptor: SerializedItemDescriptor | undefined) => void,
  ): void {
    const itemsForKind = this.allData?.find((kvp) => kvp.key.namespace === kind.namespace)?.item;
    callback(itemsForKind?.find((kvp) => kvp.key === key)?.item ?? undefined);
  }

  getAll(
    kind: PersistentStoreDataKind,
    callback: (descriptors: KeyedItem<string, SerializedItemDescriptor>[] | undefined) => void,
  ): void {
    callback(this.allData?.find((kvp) => kvp.key.namespace === kind.namespace)?.item);
  }

  upsert(
    kind: PersistentStoreDataKind,
    key: string,
    descriptor: SerializedItemDescriptor,
    callback: (
      err?: Error | undefined,
      updatedDescriptor?: SerializedItemDescriptor | undefined,
    ) => void,
  ): void {
    const itemsForKind = this.allData?.find((kvp) => kvp.key.namespace === kind.namespace)?.item;
    const slot = itemsForKind?.find((kvp) => kvp.key === key);
    let updated: SerializedItemDescriptor | undefined;
    if (slot) {
      if (slot.item.version < descriptor.version) {
        slot.item = descriptor;
      }
      updated = slot.item;
    } else {
      updated = descriptor;
      itemsForKind?.push({ key, item: updated });
    }
    callback(undefined, updated);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    callback(this.isInitialized);
  }

  close(): void {
    this.closed = true;
  }

  // eslint-disable-next-line class-methods-use-this
  getDescription(): string {
    return 'mock';
  }
}

describe.each(['caching', 'non-caching'])(
  'given a persistent store implementation and %s wrapper',
  (type) => {
    let mockPersistentStore: MockPersistentStore;
    let wrapper: PersistentDataStoreWrapper;
    let asyncWrapper: AsyncStoreFacade;

    const isCaching = type === 'caching';

    beforeEach(() => {
      mockPersistentStore = new MockPersistentStore();
      wrapper = new PersistentDataStoreWrapper(mockPersistentStore!, type === 'caching' ? 60 : 0);
      asyncWrapper = new AsyncStoreFacade(wrapper);
    });

    afterEach(() => {
      wrapper.close();
      jest.restoreAllMocks();
    });

    it('is not initialized to start', async () => {
      const initialized = await asyncWrapper.initialized();

      expect(initialized).toBeFalsy();
    });

    it('it has a description', async () => {
      expect(wrapper.getDescription()).toEqual('mock');
    });

    itif(isCaching)(
      'it only checks the store for initialization once within the ttl.',
      async () => {
        const spy = jest.spyOn(mockPersistentStore, 'initialized');
        await asyncWrapper.initialized();
        await asyncWrapper.initialized();
        await asyncWrapper.initialized();

        expect(spy).toHaveBeenCalledTimes(1);
      },
    );

    itif(!isCaching)(
      'checks for initialization all go to the store without caching and not initialized.',
      async () => {
        const spy = jest.spyOn(mockPersistentStore, 'initialized');
        await asyncWrapper.initialized();
        await asyncWrapper.initialized();
        await asyncWrapper.initialized();

        expect(spy).toHaveBeenCalledTimes(3);
      },
    );

    it('becomes initialized if the underlying store is initialized', async () => {
      const spy = jest.spyOn(mockPersistentStore, 'initialized');
      mockPersistentStore.isInitialized = true;

      const isInitialized = await asyncWrapper.initialized();
      expect(isInitialized).toEqual(true);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    itif(isCaching)(
      'if the ttl for initialization has passed, then it will check the store again.',
      async () => {
        jest.spyOn(Date, 'now').mockImplementation(() => 0);
        const spy = jest.spyOn(mockPersistentStore, 'initialized');
        await asyncWrapper.initialized();
        jest.spyOn(Date, 'now').mockImplementation(() => 600001);
        await asyncWrapper.initialized();
        await asyncWrapper.initialized();

        expect(spy).toHaveBeenCalledTimes(2);
      },
    );

    it('if the ttl for initialization has passed, but initialization was complete, it will not check the store.', async () => {
      jest.spyOn(Date, 'now').mockImplementation(() => 0);
      const spy = jest.spyOn(mockPersistentStore, 'initialized');
      mockPersistentStore.isInitialized = true;
      await asyncWrapper.initialized();
      jest.spyOn(Date, 'now').mockImplementation(() => 600001);
      await asyncWrapper.initialized();
      await asyncWrapper.initialized();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('can be initialized', async () => {
      await asyncWrapper.init({});

      const initialized = await asyncWrapper.initialized();

      expect(initialized).toBeTruthy();
    });

    it("can get an item that doesn't exist", async () => {
      const value = await asyncWrapper.get(persistentStoreKinds.features, 'key1');
      expect(value).toBeNull();
    });

    itif(isCaching)('can get an item which is cached', async () => {
      await asyncWrapper.init({
        features: {
          key1: {
            deleted: false,
            version: 1,
          },
        },
        segments: {
          key2: {
            deleted: false,
            version: 2,
          },
        },
      });

      const spy = jest.spyOn(mockPersistentStore, 'get');
      const value = await asyncWrapper.get(VersionedDataKinds.Features, 'key1');
      const value2 = await asyncWrapper.get(VersionedDataKinds.Segments, 'key2');
      expect(value).toEqual({
        deleted: false,
        version: 1,
      });

      expect(value2).toEqual({
        deleted: false,
        version: 2,
      });
      // Should be in the cache from init, so we do not call the store.
      expect(spy).toBeCalledTimes(0);
    });

    itif(isCaching)('getting all uses the value cached from init', async () => {
      await asyncWrapper.init({
        features: {
          key1: {
            deleted: false,
            version: 1,
          },
        },
        segments: {
          key2: {
            deleted: false,
            version: 2,
          },
        },
      });

      const spy = jest.spyOn(mockPersistentStore, 'getAll');

      const allFlags = await asyncWrapper.all(VersionedDataKinds.Features);
      const allSegments = await asyncWrapper.all(VersionedDataKinds.Segments);

      expect(allFlags).toEqual({
        key1: {
          deleted: false,
          version: 1,
        },
      });

      expect(allSegments).toEqual({
        key2: {
          deleted: false,
          version: 2,
        },
      });

      // Should be in the cache from init, so we do not call the store.
      expect(spy).toBeCalledTimes(0);
    });

    it('after something is upserted, then the cache is not used for getting all values', async () => {
      await asyncWrapper.init({
        features: {
          key1: {
            deleted: false,
            version: 1,
          },
        },
        segments: {
          key2: {
            deleted: false,
            version: 2,
          },
        },
      });

      // Manipulate the store to be different from the cache.
      mockPersistentStore.allData = [
        {
          key: persistentStoreKinds.features,
          item: [
            {
              key: 'key1',
              item: {
                version: 3,
                serializedItem: '{"version": 3, "deleted": false, "value": "yes"}',
              },
            },
          ],
        },
        {
          key: persistentStoreKinds.segments,
          item: [
            {
              key: 'key2',
              item: {
                version: 4,
                serializedItem: '{"version": 4, "deleted": false, "value": "no"}',
              },
            },
          ],
        },
      ];
      const spy = jest.spyOn(mockPersistentStore, 'getAll');

      asyncWrapper.upsert(VersionedDataKinds.Features, {
        key: 'key3',
        version: 5,
      });

      const allFlags = await asyncWrapper.all(VersionedDataKinds.Features);
      const allSegments = await asyncWrapper.all(VersionedDataKinds.Segments);

      expect(allFlags).toEqual({
        key1: {
          deleted: false,
          version: 3,
          value: 'yes',
        },
        key3: {
          key: 'key3',
          version: 5,
        },
      });

      expect(allSegments).toEqual({
        key2: {
          deleted: false,
          value: 'no',
          version: 4,
        },
      });

      // These should not be cached, because of the upsert.
      expect(spy).toBeCalledTimes(2);
    });

    it('can get an item which exists and is not cached', async () => {
      await asyncWrapper.init({});
      mockPersistentStore.allData?.push({
        key: persistentStoreKinds.features,
        item: [
          {
            key: 'key1',
            item: {
              version: 1,
              serializedItem: '{"version": 1, "deleted": false, "value": "yes"}',
            },
          },
        ],
      });

      const spy = jest.spyOn(mockPersistentStore, 'get');
      const value = await asyncWrapper.get(VersionedDataKinds.Features, 'key1');
      expect(value).toEqual({
        deleted: false,
        version: 1,
        value: 'yes',
      });
      // Should not be in the cache, so we should hit the store.
      expect(spy).toBeCalledTimes(1);
    });

    it('it can delete an item', async () => {
      await asyncWrapper.init({
        features: {
          key1: {
            deleted: false,
            version: 1,
          },
          key3: {
            deleted: false,
            version: 6,
          },
        },
        segments: {
          key2: {
            deleted: false,
            version: 2,
          },
        },
      });

      const spy = jest.spyOn(mockPersistentStore, 'getAll');

      asyncWrapper.delete(VersionedDataKinds.Features, 'key3', 7);

      const allFlags = await asyncWrapper.all(VersionedDataKinds.Features);
      const allSegments = await asyncWrapper.all(VersionedDataKinds.Segments);

      expect(allFlags).toEqual({
        key1: {
          deleted: false,
          version: 1,
        },
      });

      expect(allSegments).toEqual({
        key2: {
          deleted: false,
          version: 2,
        },
      });

      // These should not be cached, because of the upsert.
      expect(spy).toBeCalledTimes(2);
    });

    it('closes the core store', async () => {
      const spy = jest.spyOn(mockPersistentStore, 'close');
      await asyncWrapper.close();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('handles invalid JSON in the store', async () => {
      mockPersistentStore.allData = [
        {
          key: persistentStoreKinds.features,
          item: [
            {
              key: 'key1',
              item: {
                version: 3,
                serializedItem: '{sorry',
              },
            },
          ],
        },
      ];
      mockPersistentStore.isInitialized = true;

      // There are no exceptions or anything.
      const value = await asyncWrapper.get(VersionedDataKinds.Features, 'key1');
      expect(value).toBeNull();
    });

    it('handles a deleted item without a serialized item from an upsert', async () => {
      jest.spyOn(mockPersistentStore, 'upsert').mockImplementation((_kind, _key, _data, cb) => {
        cb(undefined, {
          deleted: true,
          version: 2,
        });
      });

      await asyncWrapper.upsert(VersionedDataKinds.Features, { key: 'key1', version: 1 });

      // There are no exceptions or anything.
      const value = await asyncWrapper.get(VersionedDataKinds.Features, 'key1');
      expect(value).toBeNull();
    });

    it('if there is an error during an upsert, then that item remains in the cache as it was', async () => {
      await asyncWrapper.init({
        features: {
          key1: {
            version: 1,
          },
        },
      });

      jest.spyOn(mockPersistentStore, 'upsert').mockImplementation((_kind, _key, _data, cb) => {
        cb(new Error('bad news'), undefined);
      });

      asyncWrapper.upsert(VersionedDataKinds.Features, {
        key: 'key1',
        version: 2,
      });

      const value = await asyncWrapper.get(VersionedDataKinds.Features, 'key1');
      expect(value).toEqual({ version: 1 });
    });

    it('handles the case where nothing is in the store for the specified kind', async () => {
      asyncWrapper.init({});
      const allFlags = await asyncWrapper.all(VersionedDataKinds.Features);
      expect(allFlags).toEqual({});
    });

    it('correctly handles getting deleted items', async () => {
      mockPersistentStore.isInitialized = true;
      mockPersistentStore.allData?.push({
        key: persistentStoreKinds.features,
        item: [
          {
            key: 'key1',
            item: {
              version: 1,
              deleted: true,
              serializedItem: '{"version": 1, "deleted": true, "value": "yes"}',
            },
          },
        ],
      });

      const value = await asyncWrapper.get(VersionedDataKinds.Features, 'key1');
      expect(value).toBeNull();

      const allValues = await asyncWrapper.all(VersionedDataKinds.Features);
      expect(allValues).toEqual({});
    });

    it('applyChanges with basis results in initialization', async () => {
      await asyncWrapper.applyChanges(
        true,
        {
          features: {
            key1: {
              version: 1,
            },
          },
        },
        'selector1',
      );

      expect(await asyncWrapper.initialized()).toBeTruthy();
      expect(await asyncWrapper.all(VersionedDataKinds.Features)).toEqual({
        key1: {
          version: 1,
        },
      });
    });

    it('applyChanges with basis overwrites existing data', async () => {
      await asyncWrapper.applyChanges(
        true,
        {
          features: {
            oldFeature: {
              version: 1,
            },
          },
        },
        'selector1',
      );

      expect(await asyncWrapper.all(VersionedDataKinds.Features)).toEqual({
        oldFeature: {
          version: 1,
        },
      });

      await asyncWrapper.applyChanges(
        true,
        {
          features: {
            newFeature: {
              version: 1,
            },
          },
        },
        'selector1',
      );

      expect(await asyncWrapper.all(VersionedDataKinds.Features)).toEqual({
        newFeature: {
          version: 1,
        },
      });
    });

    it('applyChanges callback fires after all upserts complete', async () => {
      let callbackCount = 0;
      jest
        .spyOn(mockPersistentStore, 'upsert')
        .mockImplementation(async (_kind, _key, _data, cb) => {
          callbackCount += 1;
          // this await gives chance for execution to continue elsewhere. If there is a bug, this will lead to a failure
          await new Promise((f) => {
            setTimeout(f, 1);
          });
          cb();
        });

      await asyncWrapper.applyChanges(
        false,
        {
          features: {
            key1: {
              version: 1,
            },
            key2: {
              version: 1,
            },
            key3: {
              version: 1,
            },
          },
        },
        'selector',
      );
      expect(callbackCount).toEqual(3);
    });

    it('applyChanges with basis=false merges correctly', async () => {
      await asyncWrapper.applyChanges(
        true,
        {
          features: {
            key1: {
              version: 1,
            },
            key2: {
              version: 1,
            },
          },
        },
        'selector',
      );

      await asyncWrapper.applyChanges(
        false,
        {
          features: {
            key1: {
              version: 2,
            },
            key3: {
              version: 1,
            },
          },
        },
        'selector',
      );

      expect(await asyncWrapper.all(VersionedDataKinds.Features)).toEqual({
        key1: {
          key: 'key1',
          version: 2,
        },
        key2: {
          version: 1,
        },
        key3: {
          key: 'key3',
          version: 1,
        },
      });
    });
  },
);
