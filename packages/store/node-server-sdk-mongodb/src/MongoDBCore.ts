import { interfaces, LDLogger } from '@launchdarkly/node-server-sdk';

import MongoDBClientState from './MongoDBClientState';

/**
 * @internal
 */
interface FeatureDocument {
  _id: string;
  namespace: string;
  version: number;
  item?: string;
  deleted?: boolean;
}

/**
 * @internal
 */
interface InitializedDocument {
  _id: string;
  initialized: boolean;
  timestamp: Date;
}

/**
 * @internal
 */
export const COLLECTION_FEATURES = 'features';

/**
 * @internal
 */
export const COLLECTION_SEGMENTS = 'segments';

/**
 * @internal
 */
export const COLLECTION_INITIALIZED = 'initialized';

/**
 * @internal
 */
export const INITIALIZED_TOKEN = '$inited';

/**
 * Internal implementation of the MongoDB feature store.
 *
 * Implementation notes:
 *
 * Feature flags, segments, and any other kind of entity the LaunchDarkly client may wish
 * to store, are stored in separate collections based on their namespace (e.g., "features", "segments").
 * Each document contains:
 * - `_id`: The key of the item
 * - `namespace`: The namespace (for consistency and queries)
 * - `version`: The version number (for optimistic updates)
 * - `item`: The serialized JSON data (when not deleted)
 * - `deleted`: Boolean flag indicating if the item is deleted
 *
 * The initialization state is tracked using a special document in the "initialized" collection.
 *
 * MongoDB's document-based storage allows us to store the entire serialized item as a single
 * field, similar to DynamoDB but with more flexible querying capabilities.
 *
 * For upsert operations, we use MongoDB's conditional updates with version checking to ensure
 * consistency without requiring transactions.
 *
 * @internal
 */
export default class MongoDBCore implements interfaces.PersistentDataStore {
  private readonly _initedKey: string;

  constructor(
    private readonly _state: MongoDBClientState,
    private readonly _logger?: LDLogger,
  ) {
    this._initedKey = INITIALIZED_TOKEN;
  }

  async init(
    allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
    callback: () => void,
  ): Promise<void> {
    try {
      // Read existing items for all namespaces to determine what to delete
      const existingItems = new Set<string>();

      for (const collection of allData) {
        const { namespace } = collection.key;
        const mongoCollection = await this._state.getCollection<FeatureDocument>(namespace);
        const existingDocs = await mongoCollection.find({}, { projection: { _id: 1 } }).toArray();

        for (const doc of existingDocs) {
          existingItems.add(`${namespace}:${doc._id}`);
        }
      }

      // Process new data and mark items that should remain
      const itemsToKeep = new Set<string>();

      for (const collection of allData) {
        const { namespace } = collection.key;
        const items = collection.item;
        const mongoCollection = await this._state.getCollection<FeatureDocument>(namespace);

        // Prepare bulk operations for this namespace
        const bulkOps: any[] = [];

        for (const keyedItem of items) {
          const itemKey = `${namespace}:${keyedItem.key}`;
          itemsToKeep.add(itemKey);

        const doc: FeatureDocument = {
          _id: keyedItem.key,
          namespace,
          version: keyedItem.item.version,
        };

          if (keyedItem.item.deleted) {
            doc.deleted = true;
          } else if (keyedItem.item.serializedItem) {
            doc.item = keyedItem.item.serializedItem;
          }

          bulkOps.push({
            replaceOne: {
              filter: { _id: keyedItem.key },
              replacement: doc,
              upsert: true,
            },
          });
        }

        // Execute bulk operations for this namespace
        if (bulkOps.length > 0) {
          await mongoCollection.bulkWrite(bulkOps, { ordered: false });
        }
      }

      // Delete items that are no longer present in the new data
      for (const collection of allData) {
        const { namespace } = collection.key;
        const mongoCollection = await this._state.getCollection<FeatureDocument>(namespace);

        const itemsToDelete: string[] = [];
        for (const existingItem of existingItems) {
          if (existingItem.startsWith(`${namespace}:`) && !itemsToKeep.has(existingItem)) {
            itemsToDelete.push(existingItem.substring(namespace.length + 1));
          }
        }

        if (itemsToDelete.length > 0) {
          await mongoCollection.deleteMany({ _id: { $in: itemsToDelete } });
        }
      }

      // Set the initialized flag
      const initCollection = await this._state.getCollection<InitializedDocument>(COLLECTION_INITIALIZED);
      await initCollection.replaceOne(
        { _id: this._initedKey },
        { initialized: true, timestamp: new Date() } as any,
        { upsert: true }
      );

    } catch (error) {
      this._logger?.error(`Error initializing MongoDB store: ${error}`);
    }

    callback();
  }

  async get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    callback: (descriptor: interfaces.SerializedItemDescriptor | undefined) => void,
  ): Promise<void> {
    try {
      const collection = await this._state.getCollection<FeatureDocument>(kind.namespace);
      const doc = await collection.findOne({ _id: key });

      if (doc) {
        const descriptor: interfaces.SerializedItemDescriptor = {
          version: doc.version || 0,
          deleted: !!doc.deleted,
          serializedItem: doc.item,
        };
        callback(descriptor);
      } else {
        callback(undefined);
      }
    } catch (error) {
      this._logger?.error(`Error reading ${kind.namespace}:${key}: ${error}`);
      callback(undefined);
    }
  }

  async getAll(
    kind: interfaces.PersistentStoreDataKind,
    callback: (
      descriptors: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined,
    ) => void,
  ): Promise<void> {
    try {
      const collection = await this._state.getCollection<FeatureDocument>(kind.namespace);
      const docs = await collection.find({ deleted: { $ne: true } }).toArray();

      const results: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] = [];

      for (const doc of docs) {
        results.push({
          key: doc._id,
          item: {
            version: doc.version || 0,
            deleted: false,
            serializedItem: doc.item,
          },
        });
      }

      callback(results);
    } catch (error) {
      this._logger?.error(`Error reading all from ${kind.namespace}: ${error}`);
      callback(undefined);
    }
  }

  async upsert(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    descriptor: interfaces.SerializedItemDescriptor,
    callback: (
      err?: Error | undefined,
      updatedDescriptor?: interfaces.SerializedItemDescriptor | undefined,
    ) => void,
  ): Promise<void> {
    try {
      const collection = await this._state.getCollection<FeatureDocument>(kind.namespace);

      const doc: FeatureDocument = {
        _id: key,
        namespace: kind.namespace,
        version: descriptor.version,
      };

      if (descriptor.deleted) {
        doc.deleted = true;
      } else if (descriptor.serializedItem) {
        doc.item = descriptor.serializedItem;
      }

      // Use optimistic concurrency control - only update if version is higher
      const result = await collection.replaceOne(
        {
          _id: key,
          $or: [
            { version: { $exists: false } },
            { version: { $lt: descriptor.version } },
          ],
        },
        doc,
        { upsert: true }
      );

      if (result.matchedCount > 0 || result.upsertedCount > 0) {
        // Successfully updated or inserted
        callback(undefined, descriptor);
      } else {
        // Version conflict - read the current version
        this.get(kind, key, (currentDescriptor) => {
          callback(undefined, currentDescriptor);
        });
      }
    } catch (error) {
      callback(error as Error, undefined);
    }
  }

  async initialized(callback: (isInitialized: boolean) => void): Promise<void> {
    try {
      const collection = await this._state.getCollection<InitializedDocument>(COLLECTION_INITIALIZED);
      const doc = await collection.findOne({ _id: this._initedKey });
      callback(!!doc?.initialized);
    } catch (error) {
      this._logger?.error(`Error checking initialization status: ${error}`);
      callback(false);
    }
  }

  close(): void {
    this._state.close();
  }

  getDescription(): string {
    return 'MongoDB';
  }
}
