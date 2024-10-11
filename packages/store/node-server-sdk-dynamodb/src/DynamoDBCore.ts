import { AttributeValue, QueryCommandInput, WriteRequest } from '@aws-sdk/client-dynamodb';

import { interfaces, LDLogger } from '@launchdarkly/node-server-sdk';

import DynamoDBClientState from './DynamoDBClientState';
import { boolValue, numberValue, stringValue } from './Value';

// We won't try to store items whose total size exceeds this. The DynamoDB documentation says
// only "400KB", which probably means 400*1024, but to avoid any chance of trying to store a
// too-large item we are rounding it down.
const DYNAMODB_MAX_SIZE = 400000;

/**
 * Exported for testing.
 * @internal
 */
export function calculateSize(item: Record<string, AttributeValue>, logger?: LDLogger) {
  return Object.entries(item).reduce((prev, [key, value]) => {
    // see: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/CapacityUnitCalculations.html
    if (value.S) {
      return prev + key.length + Buffer.byteLength(value.S);
    }
    if (value.N) {
      // Numeric values will be over-estimated compared to the DynamoDB size calculation.
      return prev + key.length + Buffer.byteLength(value.N);
    }
    if (value.BOOL) {
      return prev + key.length + 1;
    }
    logger?.warn('Unrecognized type in size calculation');
    return prev;
  }, 100);
}

/**
 * Internal implementation of the DynamoDB feature store.
 *
 * Implementation notes:
 *
 * Feature flags, segments, and any other kind of entity the LaunchDarkly client may wish
 * to store, are all put in the same table. The only two required attributes are "key" (which
 * is present in all store-able entities) and "namespace" (a parameter from the client that is
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
export default class DynamoDBCore implements interfaces.PersistentDataStore {
  constructor(
    private readonly _tableName: string,
    private readonly _state: DynamoDBClientState,
    private readonly _logger?: LDLogger,
  ) {}

  private _initializedToken() {
    const prefixed = stringValue(this._state.prefixedKey('$inited'));
    return { namespace: prefixed, key: prefixed };
  }

  /**
   * For a set of init data read all the existing data with matching namespaces.
   * @param allData A set of init data.
   * @returns A list of all data with matching namespaces.
   */
  private async _readExistingItems(
    allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
  ) {
    const promises = allData.map((kind) => {
      const { namespace } = kind.key;
      return this._state.query(this._queryParamsForNamespace(namespace));
    });

    const records = (await Promise.all(promises)).flat();
    return records;
  }

  /**
   * Mashal a SerializedItemDescriptor into an item for the DB.
   * @param kind The kind of the data.
   * @param item The item to marshal.
   * @returns The marshalled data.
   */
  private _marshalItem(
    kind: interfaces.PersistentStoreDataKind,
    item: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>,
  ): Record<string, AttributeValue> {
    const dbItem: Record<string, AttributeValue> = {
      namespace: stringValue(this._state.prefixedKey(kind.namespace)),
      key: stringValue(item.key),
      version: numberValue(item.item.version),
    };
    if (item.item.serializedItem) {
      dbItem.item = stringValue(item.item.serializedItem);
    }
    return dbItem;
  }

  private _unmarshalItem(
    dbItem: Record<string, AttributeValue>,
  ): interfaces.SerializedItemDescriptor {
    return {
      // Version should exist.
      version: parseInt(dbItem.version?.N || '0', 10),
      // These fields may be undefined, and that is fine.
      deleted: !!dbItem.deleted?.BOOL,
      serializedItem: dbItem.item?.S,
    };
  }

  async init(
    allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
    callback: () => void,
  ) {
    const items = await this._readExistingItems(allData);

    // Make a key from an existing DB item.
    function makeNamespaceKey(item: Record<string, AttributeValue>) {
      return `${item.namespace.S}$${item.key.S}`;
    }

    const existingNamespaceKeys: { [key: string]: boolean } = {};
    items.forEach((item) => {
      existingNamespaceKeys[makeNamespaceKey(item)] = true;
    });
    delete existingNamespaceKeys[makeNamespaceKey(this._initializedToken())];

    // Generate a list of write operations, and then execute them in a batch.
    const ops: WriteRequest[] = [];

    allData.forEach((collection) => {
      collection.item.forEach((item) => {
        const dbItem = this._marshalItem(collection.key, item);
        if (this._checkSizeLimit(dbItem)) {
          delete existingNamespaceKeys[
            `${this._state.prefixedKey(collection.key.namespace)}$${item.key}`
          ];
          ops.push({ PutRequest: { Item: dbItem } });
        }
      });
    });

    // Remove existing data that is not in the new list.
    Object.keys(existingNamespaceKeys).forEach((namespaceKey) => {
      const namespaceAndKey = namespaceKey.split('$');
      ops.push({
        DeleteRequest: {
          Key: { namespace: stringValue(namespaceAndKey[0]), key: stringValue(namespaceAndKey[1]) },
        },
      });
    });

    // Always write the initialized token when we initialize.
    ops.push({ PutRequest: { Item: this._initializedToken() } });

    await this._state.batchWrite(this._tableName, ops);
    callback();
  }

  async get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    callback: (descriptor: interfaces.SerializedItemDescriptor | undefined) => void,
  ) {
    const read = await this._state.get(this._tableName, {
      namespace: stringValue(this._state.prefixedKey(kind.namespace)),
      key: stringValue(key),
    });
    if (read) {
      callback(this._unmarshalItem(read));
    } else {
      callback(undefined);
    }
  }

  async getAll(
    kind: interfaces.PersistentStoreDataKind,
    callback: (
      descriptors: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined,
    ) => void,
  ) {
    const params = this._queryParamsForNamespace(kind.namespace);
    const results = await this._state.query(params);
    callback(
      results.map((record) => ({ key: record!.key!.S!, item: this._unmarshalItem(record) })),
    );
  }

  async upsert(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    descriptor: interfaces.SerializedItemDescriptor,
    callback: (
      err?: Error | undefined,
      updatedDescriptor?: interfaces.SerializedItemDescriptor | undefined,
    ) => void,
  ) {
    const params = this._makeVersionedPutRequest(kind, { key, item: descriptor });
    if (!this._checkSizeLimit(params.Item)) {
      // We deliberately don't report this back to the SDK as an error, because we don't want to trigger any
      // useless retry behavior. We just won't do the update.
      callback();
      return;
    }

    try {
      await this._state.put(params);
      this.get(kind, key, (readDescriptor) => {
        callback(undefined, readDescriptor);
      });
    } catch (err) {
      callback(err as Error, undefined);
    }
  }

  async initialized(callback: (isInitialized: boolean) => void) {
    let initialized = false;
    try {
      const token = this._initializedToken();
      const data = await this._state.get(this._tableName, token);
      initialized = !!(data?.key?.S === token.key.S);
    } catch (err) {
      this._logger?.error(`Error reading inited: ${err}`);
      initialized = false;
    }
    // Callback outside the try. In case it raised an exception.
    callback(initialized);
  }

  close(): void {
    this._state.close();
  }

  getDescription(): string {
    return 'DynamoDB';
  }

  private _queryParamsForNamespace(namespace: string): QueryCommandInput {
    return {
      TableName: this._tableName,
      KeyConditionExpression: 'namespace = :namespace',
      FilterExpression: 'attribute_not_exists(deleted) OR deleted = :deleted',
      ExpressionAttributeValues: {
        ':namespace': stringValue(this._state.prefixedKey(namespace)),
        ':deleted': boolValue(false),
      },
    };
  }

  private _makeVersionedPutRequest(
    kind: interfaces.PersistentStoreDataKind,
    item: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>,
  ) {
    return {
      TableName: this._tableName,
      Item: this._marshalItem(kind, item),
      ConditionExpression: 'attribute_not_exists(version) OR version < :new_version',
      ExpressionAttributeValues: { ':new_version': numberValue(item.item.version) },
    };
  }

  private _checkSizeLimit(item: Record<string, AttributeValue>) {
    const size = calculateSize(item);

    if (size <= DYNAMODB_MAX_SIZE) {
      return true;
    }
    this._logger?.error(
      `The item "${item.key.S}" in "${item.namespace.S}" was too large to store in DynamoDB and was dropped`,
    );
    return false;
  }
}
