import { LDLogger, interfaces } from '@launchdarkly/node-server-sdk';

/**
 * Internal implementation of the DynamoDB feature store.
 *
 * Implementation notes:
 *
 * Feature flags, segments, and any other kind of entity the LaunchDarkly client may wish
 * to store, are all put in the same table. The only two required attributes are "key" (which
 * is present in all storeable entities) and "namespace" (a parameter from the client that is
 * used to disambiguate between flags and segments).
 * 
 * Because of DynamoDB's restrictions on attribute values (e.g. empty strings are not
 * allowed), the standard DynamoDB marshaling mechanism with one attribute per object property
 * is not used. Instead, the entire object is serialized to JSON and stored in a single
 * attribute, "item". The "version" property is also stored as a separate attribute since it
 * is used for updates.
 * 
 * Since DynamoDB doesn't have transactions, the init method - which replaces the entire data
 * store - is not atomic, so there can be a race condition if another process is adding new data
 * via upsert. To minimize this, we don't delete all the data at the start; instead, we update
 * the items we've received, and then delete all other items. That could potentially result in
 * deleting new data from another process, but that would be the case anyway if the init
 * happened to execute later than the upsert(); we are relying on the fact that normally the
 * process that did the init() will also receive the new data shortly and do its own upsert.
 *
 * DynamoDB has a maximum item size of 400KB. Since each feature flag or user segment is
 * stored as a single item, this mechanism will not work for extremely large flags or segments.
 * @internal
 */
export default class RedisCore implements interfaces.PersistentDataStore {
  constructor(private readonly logger?: LDLogger) {
  }

  init(
    allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
    callback: () => void
  ): void {
    throw new Error("Not implemented");
  }

  get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    callback: (descriptor: interfaces.SerializedItemDescriptor | undefined) => void
  ): void {
    throw new Error("Not implemented");
  }

  getAll(
    kind: interfaces.PersistentStoreDataKind,
    callback: (
      descriptors: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined
    ) => void
  ): void {
    throw new Error("Not implemented");
  }

  upsert(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    descriptor: interfaces.SerializedItemDescriptor,
    callback: (
      err?: Error | undefined,
      updatedDescriptor?: interfaces.SerializedItemDescriptor | undefined
    ) => void
  ): void {
    throw new Error("Not implemented");
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    throw new Error("Not implemented");
  }

  close(): void {
    throw new Error("Not implemented");
  }

  getDescription(): string {
    return 'DynamoDB'
  }
}
