import { DataKind } from './DataKind';
import { KeyedItems } from './KeyedItems';
import { VersionedData } from './VersionedData';

/**
 * Base interface for a simplified subset of the functionality of `LDFeatureStore`, to be used in
 * conjunction with `CachingStoreWrapper`.
 *
 * @see [[PersistentDataStore]]
 * @see [[PersistentDataStoreNonAtomic]]
 */
export interface PersistentDataStoreBase {
  /**
   * Get an entity from the store.
   *
   * @param kind
   *   The type of data to be accessed. The store should not make any assumptions about the format
   *   of the data, but just return a JSON object.
   *
   * @param key
   *   The unique key of the entity within the specified collection.
   *
   * @param callback
   *   Will be called with the retrieved entity, or null if not found.
   */
  getInternal(kind: DataKind, key: string, callback: (res: VersionedData) => void): void;

  /**
   * Get all entities from a collection.
   *
   * The store should filter out any entities with the property `deleted: true`.
   *
   * @param kind
   *   The type of data to be accessed. The store should not make any assumptions about the format
   *   of the data, but just return an object in which each key is the `key` property of an entity
   *   and the value is the entity. The actual type of this parameter is [[interfaces.DataKind]].
   *
   * @param callback
   *   Will be called with the resulting map.
   */
  getAllInternal(kind: DataKind, callback: (res: KeyedItems<VersionedData>) => void): void;

  /**
   * Add an entity or update an existing entity.
   *
   * @param kind
   *   The type of data to be accessed.
   *
   * @param item
   *   The contents of the entity, as an object that can be converted to JSON. The store
   *   should check the `version` property of this object, and should *not* overwrite any
   *   existing data if the existing `version` is greater than or equal to that value.
   *
   * @param callback
   *   Will be called after the upsert operation is complete.
   */
  upsertInternal(kind: DataKind, item: VersionedData, callback:
  (err: Error, finalItem: VersionedData) => void): void;

  /**
   * Tests whether the store is initialized.
   *
   * "Initialized" means that the store has been populated with data, either by the client
   * having called `init()` within this process, or by another process (if this is a shared
   * database).
   *
   * @param callback
   *   Will be called back with the boolean result.
   */
  initializedInternal(callback: (isInitialized: boolean) => void): void;

  /**
   * Releases any resources being used by the feature store.
   */
  close(): void;
}
