import {
  DataKind,
  PersistentDataStore,
  PersistentStoreDataKind,
  SerializedItemDescriptor,
} from '../api/interfaces';
import ItemDescriptor from '../api/interfaces/persistent_store/ItemDescriptor';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';
import TtlCache from '../cache/TtlCache';
import { persistentStoreKinds } from './persistentStoreKinds';
import sortDataSet from './sortDataSet';
import UpdateQueue from './UpdateQueue';

function cacheKey(kind: DataKind, key: string) {
  return `${kind.namespace}:${key}`;
}

function allForKindCacheKey(kind: DataKind) {
  return `$all:${kind.namespace}`;
}

// This key will be set in the cache if we have checked that a store was
// initialized and found that it was not. If we do not become initialized
// within the TTL period, then the key will expire, and the next initialization
// check will pass through to the store. Once we are initialized, then the key
// will never be checked again.
const initializationCheckedKey = '$checkedInit';

// The interval to check items in the TTL cache to purge expired items.
// Expired items which are not purged, will be reactively purged when they are
// accessed.
const defaultCheckInterval = 600;

function itemIfNotDeleted(item: ItemDescriptor): LDFeatureStoreItem | null {
  return !item || item.item.deleted ? null : item.item;
}

function deletedDescriptor(version: number): ItemDescriptor {
  return {
    version,
    item: { version, deleted: true },
  };
}

/**
 * Deserialize a {@link SerializedItemDescriptor}
 * @param kind The persistent store data kind to deserialize.
 * @param descriptor The serialized descriptor we want to deserialize.
 * @returns An item descriptor for the deserialized item.
 */
function deserialize(
  kind: PersistentStoreDataKind,
  descriptor: SerializedItemDescriptor,
): ItemDescriptor {
  if (descriptor.deleted || !descriptor.serializedItem) {
    return deletedDescriptor(descriptor.version);
  }
  const deserializedItem: ItemDescriptor | undefined = kind.deserialize(descriptor.serializedItem);
  if (deserializedItem === undefined) {
    // This would only happen if the JSON is invalid.
    return deletedDescriptor(descriptor.version);
  }
  if (
    deserializedItem.version === 0 ||
    deserializedItem.version === descriptor.version ||
    deserializedItem.item === undefined
  ) {
    return deserializedItem;
  }
  // There was a mismatch between the version of the serialized descriptor and the deserialized
  // descriptor. So we are going to trust the version of the serialized descriptor.
  return {
    version: descriptor.version,
    item: deserializedItem.item,
  };
}

/**
 * Internal implementation of {@link LDFeatureStore} that delegates the basic functionality to an
 * instance of {@link PersistentDataStore}. It provides optional caching behavior and other logic
 * that would otherwise be repeated in every data store implementation. This makes it easier to
 * create new database integrations by implementing only the database-specific logic.
 */
export default class PersistentDataStoreWrapper implements LDFeatureStore {
  private _isInitialized = false;

  /**
   * Cache for storing individual items.
   */
  private _itemCache: TtlCache | undefined;

  /**
   * Cache for storing all items of a type.
   */
  private _allItemsCache: TtlCache | undefined;

  /**
   * Used to preserve order of operations of async requests.
   */
  private _queue: UpdateQueue = new UpdateQueue();

  constructor(
    private readonly _core: PersistentDataStore,
    ttl: number,
  ) {
    if (ttl) {
      this._itemCache = new TtlCache({
        ttl,
        checkInterval: defaultCheckInterval,
      });
      this._allItemsCache = new TtlCache({
        ttl,
        checkInterval: defaultCheckInterval,
      });
    }
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this._queue.enqueue((cb) => {
      const afterStoreInit = () => {
        this._isInitialized = true;
        if (this._itemCache) {
          this._itemCache.clear();
          this._allItemsCache!.clear();

          Object.keys(allData).forEach((kindNamespace) => {
            const kind = persistentStoreKinds[kindNamespace];
            const items = allData[kindNamespace];
            this._allItemsCache!.set(allForKindCacheKey(kind), items);
            Object.keys(items).forEach((key) => {
              const itemForKey = items[key];

              const itemDescriptor: ItemDescriptor = {
                version: itemForKey.version,
                item: itemForKey,
              };
              this._itemCache!.set(cacheKey(kind, key), itemDescriptor);
            });
          });
        }
        cb();
      };

      this._core.init(sortDataSet(allData), afterStoreInit);
    }, callback);
  }

  get(kind: DataKind, key: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    if (this._itemCache) {
      const item = this._itemCache.get(cacheKey(kind, key));
      if (item) {
        callback(itemIfNotDeleted(item));
        return;
      }
    }

    const persistKind = persistentStoreKinds[kind.namespace];
    this._core.get(persistKind, key, (descriptor) => {
      if (descriptor && descriptor.serializedItem) {
        const value = deserialize(persistKind, descriptor);
        this._itemCache?.set(cacheKey(kind, key), value);
        callback(itemIfNotDeleted(value));
        return;
      }
      callback(null);
    });
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    if (this._isInitialized) {
      callback(true);
    } else if (this._itemCache?.get(initializationCheckedKey)) {
      callback(false);
    } else {
      this._core.initialized((storeInitialized) => {
        this._isInitialized = storeInitialized;
        if (!this._isInitialized) {
          this._itemCache?.set(initializationCheckedKey, true);
        }
        callback(this._isInitialized);
      });
    }
  }

  all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    const items = this._allItemsCache?.get(allForKindCacheKey(kind));
    if (items) {
      callback(items);
      return;
    }

    const persistKind = persistentStoreKinds[kind.namespace];
    this._core.getAll(persistKind, (storeItems) => {
      if (!storeItems) {
        callback({});
        return;
      }

      const filteredItems: LDFeatureStoreKindData = {};
      storeItems.forEach(({ key, item }) => {
        const deserializedItem = deserialize(persistKind, item);
        const filteredItem = itemIfNotDeleted(deserializedItem);
        if (filteredItem) {
          filteredItems[key] = filteredItem;
        }
      });

      this._allItemsCache?.set(allForKindCacheKey(kind), filteredItems);
      callback(filteredItems);
    });
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this._queue.enqueue((cb) => {
      // Clear the caches which contain all the values of a specific kind.
      if (this._allItemsCache) {
        this._allItemsCache.clear();
      }

      const persistKind = persistentStoreKinds[kind.namespace];
      this._core.upsert(
        persistKind,
        data.key,
        persistKind.serialize(data),
        (err, updatedDescriptor) => {
          if (!err && updatedDescriptor) {
            if (updatedDescriptor.serializedItem) {
              const value = deserialize(persistKind, updatedDescriptor);
              this._itemCache?.set(cacheKey(kind, data.key), value);
            } else if (updatedDescriptor.deleted) {
              // Deleted and there was not a serialized representation.
              this._itemCache?.set(data.key, {
                key: data.key,
                version: updatedDescriptor.version,
                deleted: true,
              });
            }
          }
          cb();
        },
      );
    }, callback);
  }

  delete(kind: DataKind, key: string, version: number, callback: () => void): void {
    this.upsert(kind, { key, version, deleted: true }, callback);
  }

  applyChanges(
    _basis: boolean,
    _data: LDFeatureStoreDataStorage,
    _selector: String | undefined,
    _callback: () => void,
  ): void {
    // TODO: implement
  }

  close(): void {
    this._itemCache?.close();
    this._allItemsCache?.close();
    this._core.close();
  }

  getDescription(): string {
    return this._core.getDescription();
  }
}
