/**
 * Interface for a feature store component.
 *
 * The feature store is what the client uses to store feature flag data that has been received
 * from LaunchDarkly. By default, it uses an in-memory implementation; database integrations are
 * also available. Read the [SDK features guide](https://docs.launchdarkly.com/sdk/concepts/data-stores).
 * You will not need to use this interface unless you are writing your own implementation.
 *
 * Feature store methods can and should call their callbacks directly whenever possible, rather
 * than deferring them with setImmediate() or process.nextTick(). This means that if for any
 * reason you are updating or querying a feature store directly in your application code (which
 * is not part of normal use of the SDK) you should be aware that the callback may be executed
 * immediately.
 */

export interface LDFeatureStore {
  /**
   * Get an entity from the store.
   *
   * The store should treat any entity with the property `deleted: true` as "not found".
   *
   * @param kind
   *   The type of data to be accessed. The store should not make any assumptions about the format
   *   of the data, but just return a JSON object. The actual type of this parameter is
   *   [[interfaces.DataKind]].
   *
   * @param key
   *   The unique key of the entity within the specified collection.
   *
   * @param callback
   *   Will be called with the retrieved entity, or null if not found. The actual type of the result
   *   value is [[interfaces.VersionedData]].
   */
  get(kind: object, key: string, callback: (res: object) => void): void;

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
   *   Will be called with the resulting map. The actual type of the result value is
   *   `interfaces.KeyedItems<VersionedData>`.
   */
  all(kind: object, callback: (res: object) => void): void;

  /**
   * Initialize the store, overwriting any existing data.
   *
   * @param allData
   *   An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   *   the value is an object that maps keys to entities. The actual type of this parameter is
   *   `interfaces.FullDataSet<VersionedData>`.
   *
   * @param callback
   *   Will be called when the store has been initialized.
   */
  init(allData: object, callback: () => void): void;

  /**
   * Delete an entity from the store.
   *
   * Deletion should be implemented by storing a placeholder object with the property
   * `deleted: true` and a `version` property equal to the provided version. In other words,
   * it should be exactly the same as calling `upsert` with such an object.
   *
   * @param kind
   *   The type of data to be accessed. The actual type of this parameter is
   *   [[interfaces.DataKind]].
   *
   * @param key
   *   The unique key of the entity within the specified collection.
   *
   * @param version
   *   A number that must be greater than the `version` property of the existing entity in
   *   order for it to be deleted. If it is less than or equal to the existing version, the
   *   method should do nothing.
   *
   * @param callback
   *   Will be called when the delete operation is complete.
   */
  delete(kind: object, key: string, version: string, callback: () => void): void;

  /**
   * Add an entity or update an existing entity.
   *
   * @param kind
   *   The type of data to be accessed. The actual type of this parameter is
   *   [[interfaces.DataKind]].
   *
   * @param data
   *   The contents of the entity, as an object that can be converted to JSON. The store
   *   should check the `version` property of this object, and should *not* overwrite any
   *   existing data if the existing `version` is greater than or equal to that value.
   *   The actual type of this parameter is [[interfaces.VersionedData]].
   *
   * @param callback
   *   Will be called after the upsert operation is complete.
   */
  upsert(kind: object, data: object, callback: () => void): void;

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
  initialized(callback: (isInitialized: boolean) => void): void;

  /**
   * Releases any resources being used by the feature store.
   */
  close(): void;
}
