import { MaxRetriesPerRequestError } from 'ioredis/built/errors';

import { interfaces, LDLogger } from '@launchdarkly/node-server-sdk';

import RedisClientState from './RedisClientState';

/**
 * Internal implementation of the Redis data store.
 *
 * Feature flags, segments, and any other kind of entity the LaunchDarkly client may wish
 * to store, are stored as hash values with the main key "{prefix}:features", "{prefix}:segments",
 * etc.
 *
 * Redis only allows a single string value per hash key, so there is no way to store the
 * item metadata (version number and deletion status) separately from the value. The SDK understands
 * that some data store implementations don't have that capability, so it will always pass us a
 * serialized item string that contains the metadata in it, and we're allowed to return 0 as the
 * version number of a queried item to indicate "you have to deserialize the item to find out the
 * metadata".
 *
 * When doing an upsert operation we will always deserialize the item to get the version so the
 * version in the updated descriptor will be correct.
 *
 * The special key "{prefix}:$inited" indicates that the store contains a complete data set.
 *
 * @internal
 */
export default class RedisCore implements interfaces.PersistentDataStore {
  private initedKey: string;

  constructor(
    private readonly state: RedisClientState,
    private readonly logger?: LDLogger,
    private readonly localFeatureStore?: any,
  ) {
    this.initedKey = this.state.prefixedKey('$inited');
  }

  init(
    allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
    callback: () => void,
  ): void {
    const multi = this.state.getClient().multi();
    allData.forEach((keyedItems) => {
      const kind = keyedItems.key;
      const items = keyedItems.item;

      const namespaceKey = this.state.prefixedKey(kind.namespace);

      // Delete the namespace for the kind.
      multi.del(namespaceKey);

      const namespaceContent: { [key: string]: string } = {};
      items.forEach((keyedItem) => {
        // For each item which exists.
        if (keyedItem.item.serializedItem !== undefined) {
          namespaceContent[keyedItem.key] = keyedItem.item.serializedItem;
        }
      });
      // Only set if there is content to set.
      if (Object.keys(namespaceContent).length > 0) {
        multi.hmset(namespaceKey, namespaceContent);
      }
    });

    multi.set(this.initedKey, '');

    multi.exec((err) => {
      if (err) {
        this.logger?.error(`Error initializing Redis store ${err}`);
      }
      callback();
    });
  }

  get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    callback: (descriptor: interfaces.SerializedItemDescriptor | undefined) => void,
  ): void {
    if (!this.state.isConnected() && !this.state.isInitialConnection()) {
      this.logger?.warn(`Attempted to fetch key '${key}' while Redis connection is down`);
      callback(undefined);
      return;
    }

    this.state.getClient().hget(this.state.prefixedKey(kind.namespace), key, (err, val) => {
      if (err) {
        this.logger?.error(`Error fetching key '${key}' from Redis in '${kind.namespace}' ${err}`);
        callback(undefined);
      } else if (val) {
        // When getting we do not populate version and deleted.
        // The SDK will have to deserialize to access these values.
        callback({
          version: 0,
          deleted: false,
          serializedItem: val,
        });
      } else {
        callback(undefined);
      }
    });
  }

  #serializeItems(kind: any, itemsObj: Record<string, any>) {
    const serializedItemsObj: Record<string, any> = {};
    Object.keys(itemsObj).forEach((key) => {
      const value = itemsObj[key];
      serializedItemsObj[key] = kind.serialize(value).serializedItem;
    });
    return serializedItemsObj;
  }

  #prepareArray(values: Record<string, string>) {
    const results: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] = [];
    Object.keys(values).forEach((key) => {
      const value = values[key];
      // When getting we do not populate version and deleted.
      // The SDK will have to deserialize to access these values.
      results.push({ key, item: { version: 0, deleted: false, serializedItem: value } });
    });
    return results;
  }

  #useItemsFromCodefresh(
    kind: interfaces.PersistentStoreDataKind,
    callback: (
      descriptors: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined,
    ) => void,
  ) {
    this.localFeatureStore().then(
      (items: any) => {
        let localResults;
        if (kind.namespace === 'features') {
          localResults = items.features;
        } else {
          localResults = items.segments;
        }
        const serializedItems = this.#serializeItems(kind, localResults);
        callback(this.#prepareArray(serializedItems));
      },
      (error: any) => {
        console.log(error);
        callback(undefined);
      },
    );
  }

  getAll(
    kind: interfaces.PersistentStoreDataKind,
    callback: (
      descriptors: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined,
    ) => void,
  ): void {
    if (!this.state.isConnected() && !this.state.isInitialConnection()) {
      this.logger?.warn('Attempted to fetch all keys while Redis connection is down');
      this.#useItemsFromCodefresh(kind, callback);
    }

    this.state.getClient().hgetall(this.state.prefixedKey(kind.namespace), (err, values) => {
      if (err) {
        this.logger?.error(`Error fetching '${kind.namespace}' from Redis ${err}`);
        if (err instanceof MaxRetriesPerRequestError) {
          this.#useItemsFromCodefresh(kind, callback);
        }
      } else if (values) {
        callback(this.#prepareArray(values));
      } else {
        callback(undefined);
      }
    });
  }

  upsert(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    descriptor: interfaces.SerializedItemDescriptor,
    callback: (
      err?: Error | undefined,
      updatedDescriptor?: interfaces.SerializedItemDescriptor | undefined,
    ) => void,
  ): void {
    // The persistent store wrapper manages interactions with a queue, so we can use watch like
    // this without concerns for overlapping transactions.
    this.state.getClient().watch(this.state.prefixedKey(kind.namespace));
    const multi = this.state.getClient().multi();

    this.get(kind, key, (old) => {
      if (old?.serializedItem) {
        // Here, unfortunately, we have to deserialize the old item just to find
        // out its version number. See notes on this class.
        // Do not look at the meta-data, as we do not read/write it independently
        // with a redis store.
        const deserializedOld = kind.deserialize(old.serializedItem);
        if ((deserializedOld?.version || 0) >= descriptor.version) {
          multi.discard();

          callback(undefined, {
            version: deserializedOld!.version,
            deleted: !deserializedOld?.item, // If there is no item, then it is deleted.
            serializedItem: old.serializedItem,
          });
          return;
        }
      }
      if (descriptor.deleted) {
        multi.hset(
          this.state.prefixedKey(kind.namespace),
          key,
          JSON.stringify({ version: descriptor.version, deleted: true }),
        );
      } else if (descriptor.serializedItem) {
        multi.hset(this.state.prefixedKey(kind.namespace), key, descriptor.serializedItem);
      } else {
        // This call violates the contract.
        multi.discard();
        this.logger?.error('Attempt to write a non-deleted item without data to Redis.');
        callback(undefined, undefined);
        return;
      }
      multi.exec((err, replies) => {
        if (!err && (replies === null || replies === undefined)) {
          // This means the EXEC failed because someone modified the watched key
          this.logger?.debug('Concurrent modification detected, retrying');
          this.upsert(kind, key, descriptor, callback);
        } else {
          callback(err || undefined, descriptor);
        }
      });
    });
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    this.state.getClient().exists(this.initedKey, (err, count) => {
      // Initialized if there is not an error and the key does exists.
      // (A count >= 1)
      callback(!!(!err && count));
    });
  }

  close(): void {
    this.state.close();
  }

  getDescription(): string {
    return 'Redis';
  }
}
