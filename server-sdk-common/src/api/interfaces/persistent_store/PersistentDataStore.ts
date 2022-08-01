import KeyedItem from './KeyedItem';
import PersistentStoreDataKind from './PersistentStoreDataKind';
import SerializedItemDescriptor from './SerializedItemDescriptor';

// Shorthand for an array of keyed items.
export type KeyedItems<K, T> = KeyedItem<K, T>[];
// A store organized by a kind and then items.
export type KindKeyedStore<Kind> = KeyedItems<Kind, KeyedItems<string, SerializedItemDescriptor>>;

/**
 * This interface should be used for database integrations, or any other data store
 * implementation that stores data in some external service. The SDK will take care of
 * converting between its own internal data model and a serialized string form; the data
 * store interacts only with the serialized form. The SDK will also provide its own caching
 * layer on top of the persistent data store; the data store implementation should not
 * provide caching, but simply do every query or update that the SDK tells it to do.
 *
 * Conceptually, each item in the store is a {@link SerializedItemDescriptor} which always has
 * a version number, and can represent either a serialized object or a placeholder (tombstone)
 * for a deleted item. There are two approaches a persistent store implementation can use for
 * persisting this data:
 *
 * 1. Preferably, it should store the version number and the
 * {@link SerializedItemDescriptor#deleted} state separately so that the object does not need to be
 * fully deserialized to read them. In this case, deleted item placeholders can ignore the value of
 * {@link SerializedItemDescriptor#item} on writes and can set it to undefined on reads. The store
 * should never call {@link DataKind#deserialize}.
 *
 * 2. If that isn't possible, then the store should simply persist the exact string from
 * {@link SerializedItemDescriptor#serializedItem} on writes, and return the persisted
 * string on reads (returning zero for the version and false for
 *  {@link SerializedItemDescriptor#deleted}). The string is guaranteed to provide the SDK with
 * enough information to infer the version and the deleted state. On updates, the store must call
 * {@link PersistentStoreDataKind#deserialize} in order to inspect the version number of the
 * existing item if any.
 */
export default interface PersistentDataStore {

  /**
   * Overwrites the store's contents with a set of items for each collection.
   *
   * All previous data should be discarded, regardless of versioning.
   *
   * The update should be done atomically. If it cannot be done atomically, then the store
   * must first add or update each item in the same order that they are given in the input
   * data, and then delete any previously stored items that were not in the input data.
   *
   * @param allData a list of {@link PersistentStoreDataKind} instances and their corresponding data
   * sets
   */
  init(
    allData: KindKeyedStore<PersistentStoreDataKind>,
    callback: () => void,
  ): void;

  /**
   * Retrieves an item from the specified collection, if available.
   *
   * If the key is not known at all, the callback should be invoked with undefined. Otherwise, it
   * should be invoked with a {@link SerializedItemDescriptor} as follows:
   *
   * 1. If the version number and deletion state can be determined without fully deserializing
   * the item, then the store should set those properties in the {@link SerializedItemDescriptor}
   * (and can set {@link SerializedItemDescriptor#serializedItem} to undefined for deleted items).
   *
   * 2. Otherwise, it should simply set {@link SerializedItemDescriptor#serializedItem} to
   * the exact string that was persisted, and can leave the other properties as zero/false. See
   * comments on {@link PersistentDataStore} for more about this.
   *
   * @param kind specifies which collection to use
   * @param key the unique key of the item within that collection
   * @param callback a callback which will be invoked on completion of the get
   */
  get(
    kind: PersistentStoreDataKind,
    key: string,
    callback: (descriptor: SerializedItemDescriptor | undefined) => void,
  ): void;

  /**
   * Retrieves all items from the specified collection.
   *
   * If the store contains placeholders for deleted items, it should include them in the results,
   * not filter them out. See {@link #get} for how to set the properties of the
   * {@link SerializedItemDescriptor} for each item.
   *
   * @param kind specifies which collection to use
   * @param callback method that will be invoked with the results of the operation.
   */
  getAll(
    kind: PersistentStoreDataKind,
    callback: (descriptors: KeyedItem<string, SerializedItemDescriptor>[] | undefined) => void
  ): void;

  /**
   * Updates or inserts an item in the specified collection.
   *
   * If the given key already exists in that collection, the store must check the version number
   * of the existing item (even if it is a deleted item placeholder); if that version is greater
   * than or equal to the version of the new item, the update fails and the method returns false.
   * If the store is not able to determine the version number of an existing item without fully
   * deserializing the existing item, then it is allowed to call
   * {@link PersistentStoreDataKind#deserialize} for that purpose.
   *
   * If the item's {@link SerializedItemDescriptor#deleted} method returns true, this is a
   * deleted item placeholder. The store must persist this, rather than simply removing the key
   * from the store. The SDK will provide a string in
   * {@link SerializedItemDescriptor#serializedItem} which the store can persist for this purpose;
   * or, if the store is capable of persisting the version number and deleted state without storing
   * anything else, it should do so.
   *
   * @param kind specifies which collection to use
   * @param key the unique key for the item within that collection
   * @param descriptor the item to insert or update
   * @param callback will be called with `true` if the item was inserted, or `false` if the version
   * was not newer than the existing item.
   */
  upsert(
    kind: PersistentStoreDataKind,
    key: string,
    descriptor: SerializedItemDescriptor,
    callback: (err?: Error, updatedDescriptor?: SerializedItemDescriptor) => void
  ): void;

  /**
   * Tests whether the store is initialized.
   *
   * "Initialized" means that the store has been populated with data, either by the client
   * having called {@link #init} within this process, or by another process (if this is a shared
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

  /**
   * Get a description of the feature store.
   */
  getDescription(): string;
}
