import { DataKind, FullDataSet, KeyedItems, PersistentDataStore, PersistentDataStoreBase, PersistentDataStoreNonAtomic, VersionedData } from '../api/interfaces';
import { LDFeatureStore, LDFeatureStoreDataStorage, LDFeatureStoreItem, LDFeatureStoreKindData, LDKeyedFeatureStoreItem } from '../api/subsystems';
import TtlCache from '../cache/TtlCache';
import UpdateQueue from './UpdateQueue';
import VersionedDataKinds, { VersionedDataKind } from './VersionedDataKinds';

/**
 * Check a store to see if it is non-atomic.
 * @param u The store to check.
 * @returns True if the store is non-atomic.
 */
function isNonAtomicStore(u: any): u is PersistentDataStoreNonAtomic {
  return Object.prototype.hasOwnProperty.call(u, "initOrderedInternal");
}

function cacheKey(kind: DataKind, key: string) {
  return kind.namespace + ':' + key;
}

function allCacheKey(kind: DataKind) {
  return '$all:' + kind.namespace;
}

function itemIfNotDeleted(
  item: LDFeatureStoreItem | null | undefined
): LDFeatureStoreItem | null {
  return !item || item.deleted ? null : item;
}

// This key will be set in the cache if we have checked that a store was
// initialized and found that it was not.
const initializationCheckedKey = '$checkedInit';

const dataKind: Record<string, VersionedDataKind> = {
  segments: VersionedDataKinds.Segments,
  features: VersionedDataKinds.Features
};

/**
 * For non-atomic stores we want to insert items in an order that no items exist
 * in the store before their dependencies. Segments before flags, because flags
 * are dependent on segments. For flags we want to insert them such that no flags are
 * added before the prerequisites of those flags.
 * 
 * Segments can also depend on other segments, but a segment will not be accessed
 * if there are no flags.
 */
function sortAllCollections(
  dataMap: LDFeatureStoreDataStorage
): { kind: VersionedDataKind, items: LDKeyedFeatureStoreItem[] }[] {
  const result: { kind: VersionedDataKind, items: LDKeyedFeatureStoreItem[] }[] = [];

  Object.keys(dataMap).forEach(kindNamespace => {
    const kind = dataKind[kindNamespace];
    result.push({ kind: kind, items: topologicalSort(kind, dataMap[kindNamespace]) });
  });

  result.sort((i1, i2) => i1.kind.priority - i2.kind.priority);
  return result;
}

/**
 * Do a topological sort using a depth-first search.
 * https://en.wikipedia.org/wiki/Topological_sorting
 */
function topologicalSort(kind: VersionedDataKind, itemsMap: LDFeatureStoreKindData): LDKeyedFeatureStoreItem[] {
  const sortedItems: LDKeyedFeatureStoreItem[] = [];
  const unvisitedItems: Set<string> = new Set(Object.keys(itemsMap));

  const visit = (key: string) => {
    if (!unvisitedItems.has(key)) {
      return;
    }

    // Typically in a depth-first search this would be done later, and there
    // would be a temporary mark to detect that this was not an directed acylic graph.
    // Removing it here will mean we cannot do that detection, but we also will
    // not infinitely recurse.
    unvisitedItems.delete(key);

    // Making a shallow copy so we can add a key without affecting the original.
    const item = { ...itemsMap[key] };

    if (kind.getDependencyKeys) {
      kind.getDependencyKeys(item).forEach(prereqKey => {
        visit(prereqKey);
      });
    }

    // Make sure the item has the key.
    // LDFeatureStoreKindData from allData: LDFeatureStoreDataStorage does
    // not require that there be keys. Though the object may have a key
    // already depending on how it was used before this point.
    item.key = key;

    //It is a keyed item now.
    sortedItems.push(item as LDKeyedFeatureStoreItem);
  };

  while (unvisitedItems.size > 0) {
    // Visit the next item, the order we visit doesn't matter.
    const key = unvisitedItems.values().next().value
    visit(key);
  }
  return sortedItems;
}

/*
  CachingStoreWrapper provides commonly needed functionality for implementations of an
  SDK feature store. The underlyingStore must implement a simplified interface for
  querying and updating the data store, while CachingStoreWrapper adds optional caching of
  stored items and of the initialized state, and ensures that asynchronous operations are
  serialized correctly.

  The underlyingStore object must have the following methods:

  - getInternal(kind, key, callback): Queries a single item from the data store. The kind
  parameter is an object with a "namespace" property that uniquely identifies the
  category of data (features, segments), and the key is the unique key within that
  category. It calls the callback with the resulting item as a parameter, or, if no such
  item exists, null/undefined. It should not attempt to filter out any items, nor to
  cache any items.

  - getAllInternal(kind, callback): Queries all items in a given category from the data
  store, calling the callback with an object where each key is the item's key and each
  value is the item. It should not attempt to filter out any items, nor to cache any items.

  - upsertInternal(kind, newItem, callback): Adds or updates a single item. If an item with
  the same key already exists (in the category specified by "kind"), it should update it
  only if the new item's "version" property is greater than the old one. On completion, it
  should call the callback with the final state of the item, i.e. if the update succeeded
  then it passes the item that was passed in, and if the update failed due to the version
  check then it passes the item that is currently in the data store (this ensures that
  caching works correctly). Note that deletions are implemented by upserting a placeholder
  item with the property "deleted: true".

  - initializedInternal(callback): Tests whether the data store contains a complete data
  set, meaning that initInternal() or initOrderedInternal() has been called at least once.
  In a shared data store, it should be able to detect this even if the store was
  initialized by a different process, i.e. the test should be based on looking at what is
  in the data store. The method does not need to worry about caching this value;
  CachingStoreWrapper will only call it when necessary. Call callback with true or false.

  - initInternal(allData, callback): Replaces the entire contents of the data store. This
  should be done atomically (i.e. within a transaction); if that isn't possible, use
  initOrderedInternal() instead. The allData parameter is an object where each key is one
  of the "kind" objects, and each value is an object with the keys and values of all
  items of that kind. Call callback with no parameters when done.
    OR:
  - initOrderedInternal(collections, callback): Replaces the entire contents of the data
  store. The collections parameter is an array of objects, each of which has "kind" and
  "items" properties; "items" is an array of data items. Each array should be processed
  in the specified order. The store should delete any obsolete items only after writing
  all of the items provided.
*/
export default class CachingStoreWrapper implements LDFeatureStore {
  private isInitialized = false;

  private cache: TtlCache | undefined;

  private queue: UpdateQueue = new UpdateQueue();

  constructor(
    private readonly underlyingStore: PersistentDataStore | PersistentDataStoreNonAtomic,
    ttl: number,
    private readonly description: string,
  ) {
    if (ttl) {
      this.cache = new TtlCache({
        ttl,
        checkInterval: 600
      });
    }
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this.queue.enqueue((cb) => {
      const afterStoreInit = () => {
        this.isInitialized = true;
        if (this.cache) {
          // This will include the initializedKey.
          this.cache!.clear();

          Object.keys(allData).forEach(kindNamespace => {
            const kind = dataKind[kindNamespace];
            const items = allData[kindNamespace];
            this.cache!.set(allCacheKey(kind), items);
            Object.keys(items).forEach(key => {
              this.cache!.set(cacheKey(kind, key), items[key]);
            });
          });
        }
      };

      if (isNonAtomicStore(this.underlyingStore)) {
        const sorted = sortAllCollections(allData);
        this.underlyingStore.initOrderedInternal(sorted, afterStoreInit);
      } else {
        this.underlyingStore.initInternal(allData as FullDataSet<VersionedData>, afterStoreInit);
      }
    }, callback);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    if (this.isInitialized) {
      callback(true);
    } else if (this.cache?.get(initializationCheckedKey)) {
      callback(false);
    } else {
      this.underlyingStore.initializedInternal(storeInitialized => {
        this.isInitialized = storeInitialized;
        if (!this.isInitialized) {
          this.cache?.set(initializationCheckedKey, true);
        }
        callback(this.isInitialized);
      });
    }
  }

  all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    const items = this.cache?.get(allCacheKey(kind));
    if (items) {
      callback(items);
      return;
    }

    this.underlyingStore.getAllInternal(kind, items => {
      if (!items) {
        callback(items);
        return;
      }

      const filteredItems: LDFeatureStoreKindData = {};
      Object.entries(items).forEach(([key, item]) => {
        let filteredItem = itemIfNotDeleted(item);
        if (filteredItem) {
          filteredItems[key] = filteredItem;
        }
      });

      this.cache?.set(allCacheKey(kind), filteredItems);
      callback(filteredItems);
    });
  }

  get(kind: DataKind, key: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    if (this.cache) {
      const item = this.cache.get(cacheKey(kind, key));
      if (item) {
        callback(itemIfNotDeleted(item));
        return;
      }
    }

    this.underlyingStore.getInternal(kind, key, item => {
      this.cache?.set(cacheKey(kind, key), item);
      callback(itemIfNotDeleted(item));
    });
  }


  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this.queue.enqueue(
      cb => {
        // Clear the caches which contain all the values of a specific kind.
        if(this.cache) {
          Object.values(dataKind).forEach(kind => {
            this.cache?.delete(allCacheKey(kind));
          });
        }

        this.underlyingStore.upsertInternal(kind, data, (err, updatedItem) => {
          if (!err) {
            this.cache?.set(cacheKey(kind, data.key), updatedItem);
          }
          cb();
        });
      },
      callback
    );
  }

  delete(kind: DataKind, key: string, version: number, callback: () => void): void {
    this.upsert(kind, { key: key, version: version, deleted: true }, callback);
  }

  close(): void {
    this.cache?.close();
    this.underlyingStore.close();
  }
}