import { interfaces, LDLogger } from '@launchdarkly/node-server-sdk';

import RedisClientState from './RedisClientState';

/**
 * How long a connection must stay down before writes fail fast.
 *
 * A write issued during a shorter drop waits in the ioredis offline queue and is sent
 * when the connection returns. With default client options ioredis holds a queued
 * command for about this long before it rejects the command itself. Failing fast
 * before that horizon would drop writes that a reconnect was still going to deliver.
 */
const WRITE_FAIL_FAST_GRACE_MS = 10_000;

/**
 * A committed transaction can still contain per-command errors, for example WRONGTYPE.
 * Find the first one so it can be reported instead of a false success.
 */
function firstReplyError(replies: unknown): Error | undefined {
  if (!Array.isArray(replies)) {
    return undefined;
  }
  const failed = replies.find((reply) => Array.isArray(reply) && reply[0]);
  return failed?.[0];
}

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
  private _initedKey: string;

  constructor(
    private readonly _state: RedisClientState,
    private readonly _logger?: LDLogger,
    private readonly _writeFailFastGraceMs: number = WRITE_FAIL_FAST_GRACE_MS,
  ) {
    this._initedKey = this._state.prefixedKey('$inited');
  }

  /**
   * A write must fail fast only when a reconnect can no longer deliver it.
   *
   * During the initial connection, and during the grace period after a drop, the write
   * goes to the ioredis offline queue instead. The queue sends it on reconnect. When the
   * outage continues, ioredis rejects the queued write on its own, so the callback still
   * settles and a long outage is still reported as a write failure.
   */
  private _writeMustFailFast(): boolean {
    return (
      !this._state.isConnected() &&
      !this._state.isInitialConnection() &&
      this._state.disconnectedForMs() >= this._writeFailFastGraceMs
    );
  }

  init(
    allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
    callback: (err?: Error) => void,
  ): void {
    if (this._writeMustFailFast()) {
      this._logger?.warn('Attempted to initialize the store while Redis connection is down');
      callback(new Error('Redis connection is down'));
      return;
    }

    const multi = this._state.getClient().multi();
    allData.forEach((keyedItems) => {
      const kind = keyedItems.key;
      const items = keyedItems.item;

      const namespaceKey = this._state.prefixedKey(kind.namespace);

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

    multi.set(this._initedKey, '');

    multi.exec((err, replies) => {
      let error = err ?? undefined;
      if (!error && (replies === null || replies === undefined)) {
        // A nil reply means the transaction was aborted. That happens when a watch set
        // earlier on this shared connection was triggered. Nothing was written, so this
        // must be an error. The recovery engine trusts this result.
        error = new Error('Redis init transaction was aborted');
      }
      if (!error) {
        error = firstReplyError(replies);
      }
      if (error) {
        this._logger?.error(`Error initializing Redis store: ${error}`);
      }
      callback(error);
    });
  }

  get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    callback: (descriptor: interfaces.SerializedItemDescriptor | undefined) => void,
  ): void {
    if (!this._state.isConnected() && !this._state.isInitialConnection()) {
      this._logger?.warn(`Attempted to fetch key '${key}' while Redis connection is down`);
      callback(undefined);
      return;
    }

    this._state.getClient().hget(this._state.prefixedKey(kind.namespace), key, (err, val) => {
      if (err) {
        this._logger?.error(`Error fetching key '${key}' from Redis in '${kind.namespace}' ${err}`);
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

  getAll(
    kind: interfaces.PersistentStoreDataKind,
    callback: (
      descriptors: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined,
    ) => void,
  ): void {
    if (!this._state.isConnected() && !this._state.isInitialConnection()) {
      this._logger?.warn('Attempted to fetch all keys while Redis connection is down');
      callback(undefined);
      return;
    }

    this._state.getClient().hgetall(this._state.prefixedKey(kind.namespace), (err, values) => {
      if (err) {
        this._logger?.error(`Error fetching '${kind.namespace}' from Redis ${err}`);
      } else if (values) {
        const results: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] = [];
        Object.keys(values).forEach((key) => {
          const value = values[key];
          // When getting we do not populate version and deleted.
          // The SDK will have to deserialize to access these values.
          results.push({ key, item: { version: 0, deleted: false, serializedItem: value } });
        });
        callback(results);
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
    if (this._writeMustFailFast()) {
      this._logger?.warn(`Attempted to update key '${key}' while Redis connection is down`);
      callback(new Error('Redis connection is down'), undefined);
      return;
    }

    // The callback must only ever fire once. A second fire would shift the persistent
    // store wrapper's update queue twice and silently drop the next queued operation.
    // The catch handler below can observe an error after the transaction already settled.
    let settled = false;
    const settleOnce = (err?: Error, updatedDescriptor?: interfaces.SerializedItemDescriptor) => {
      if (settled) {
        return;
      }
      settled = true;
      callback(err, updatedDescriptor);
    };

    const client = this._state.getClient();
    const namespaceKey = this._state.prefixedKey(kind.namespace);

    // A Redis watch belongs to the connection, not to a transaction object. The persistent
    // store wrapper serializes the updates from this store, but the watch must be released
    // with UNWATCH whenever this attempt stops without an EXEC. A discard on an ioredis
    // multi only clears a client-side queue and never reaches the server.
    const abandonWatch = () => {
      client.unwatch().catch((unwatchErr) => {
        // The connection dropped. That also cleared the watch on the server.
        this._logger?.debug(`Error sending UNWATCH to Redis: ${unwatchErr}`);
      });
    };

    // The transaction starts only after the watch succeeds. If the watch fails, this
    // attempt is abandoned before it queues any command. Otherwise its exec could run
    // later on the shared connection and clear the watch of the next queued update.
    //
    // The WATCH and the read travel in one pipeline. ioredis writes pipeline commands
    // only on a ready connection, and it resends them only as a unit. A bare watch()
    // has the ioredis loading flag, so it can be written to a socket that is not ready
    // yet and be discarded without a rejection. A bare read sent after the watch reply
    // can be resent alone on a reconnected socket that has no watch, and the write
    // after it would commit without the version-check protection.
    client
      .pipeline()
      .watch(namespaceKey)
      .hget(namespaceKey, key)
      .exec()
      .then((replies) => {
        const watchReply = replies?.[0];
        const readReply = replies?.[1];
        if (!watchReply || !readReply) {
          throw new Error('The Redis watch pipeline returned no reply');
        }
        if (watchReply[0]) {
          throw watchReply[0];
        }
        // A read error must fail this attempt. Treating it as a missing item would
        // skip the version check and let an older item overwrite a newer one.
        const readErr = readReply[0];
        if (readErr) {
          this._logger?.error(
            `Error fetching key '${key}' from Redis in '${kind.namespace}': ${readErr}`,
          );
          abandonWatch();
          settleOnce(readErr as Error, undefined);
          return;
        }
        const oldItem = readReply[1] as string | null;
        if (oldItem) {
          // Here, unfortunately, we have to deserialize the old item just to find
          // out its version number. See notes on this class.
          // Do not look at the meta-data, as we do not read/write it independently
          // with a redis store.
          let deserializedOld: interfaces.ItemDescriptor | undefined;
          try {
            deserializedOld = kind.deserialize(oldItem);
          } catch (deserializeErr) {
            // A malformed stored item must not throw here, where the throw would
            // become the catch handler's error. Treat it like an unparseable item
            // and let the write below replace it.
            this._logger?.warn(
              `Malformed item for key '${key}' in '${kind.namespace}' will be overwritten: ${deserializeErr}`,
            );
          }
          if (deserializedOld && (deserializedOld.version || 0) >= descriptor.version) {
            abandonWatch();
            settleOnce(undefined, {
              version: deserializedOld.version,
              deleted: !deserializedOld.item, // If there is no item, then it is deleted.
              serializedItem: oldItem,
            });
            return;
          }
        }

        const multi = client.multi();
        if (descriptor.serializedItem) {
          multi.hset(namespaceKey, key, descriptor.serializedItem);
        } else if (descriptor.deleted) {
          // The SDK contract guarantees a serializedItem is always provided for writes,
          // including deletes, so this only runs if that contract is violated. It keeps
          // the previous placeholder shape, but adds the key so the tombstone stays
          // identifiable.
          multi.hset(
            namespaceKey,
            key,
            JSON.stringify({ key, version: descriptor.version, deleted: true }),
          );
        } else {
          // This call violates the contract.
          abandonWatch();
          this._logger?.error('Attempt to write a non-deleted item without data to Redis.');
          settleOnce(undefined, undefined);
          return;
        }
        multi.exec((err, execReplies) => {
          if (!err && (execReplies === null || execReplies === undefined)) {
            // A nil reply means the watched key changed and the EXEC was aborted.
            this._logger?.debug('Concurrent modification detected, retrying');
            // This is a fresh attempt with its own watch/settle guard, not a
            // completion of this one, so it gets the original callback, not settleOnce.
            this.upsert(kind, key, descriptor, callback);
          } else {
            // A committed transaction can still contain per-command errors.
            settleOnce(err ?? firstReplyError(execReplies), descriptor);
          }
        });
      })
      .catch((err: unknown) => {
        // A failed watch or read reply is thrown above. Without this handler that
        // throw becomes an unhandled promise rejection and can crash the process.
        // The throw can happen after the server armed the watch. Release it so a
        // stale watch cannot abort the EXEC of the next queued update.
        abandonWatch();
        this._logger?.error(`Error watching '${kind.namespace}' in Redis: ${err}`);
        settleOnce(err as Error, undefined);
      });
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    this._state.getClient().exists(this._initedKey, (err, count) => {
      if (err) {
        this._logger?.error(`Error reading initialized state from Redis: ${err}`);
      }
      // Initialized if there is not an error and the key does exists.
      // (A count >= 1)
      callback(!!(!err && count));
    });
  }

  isStoreAvailable(callback: (isAvailable: boolean) => void): void {
    // During the initial connection ioredis queues the command and may still connect.
    // Fail fast only once a prior connection has dropped.
    if (!this._state.isConnected() && !this._state.isInitialConnection()) {
      callback(false);
      return;
    }
    // A cheap read. The store is available when the command round-trip succeeds.
    // The value of the key does not matter.
    this._state.getClient().exists(this._initedKey, (err) => {
      callback(!err);
    });
  }

  close(): void {
    this._state.close();
  }

  getDescription(): string {
    return 'Redis';
  }
}
