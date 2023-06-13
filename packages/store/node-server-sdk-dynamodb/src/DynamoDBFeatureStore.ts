import {
  interfaces,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
  LDLogger,
  PersistentDataStoreWrapper,
} from '@launchdarkly/node-server-sdk';
import LDDynamoDBOptions from './LDDynamoDBOptions';
import DynamoDBCore from './DynamoDBCore';
import DynamoDBClientState from './DynamoDBClientState';
import TtlFromOptions from './TtlFromOptions';

/**
 * Integration between the LaunchDarkly SDK and DynamoDB.
 */
export default class DynamoDBFeatureStore implements LDFeatureStore {
  private wrapper: PersistentDataStoreWrapper;

  constructor(tableName: string, options?: LDDynamoDBOptions, logger?: LDLogger) {
    this.wrapper = new PersistentDataStoreWrapper(
      new DynamoDBCore(tableName, new DynamoDBClientState(options), logger),
      TtlFromOptions(options)
    );
  }

  get(
    kind: interfaces.DataKind,
    key: string,
    callback: (res: LDFeatureStoreItem | null) => void
  ): void {
    this.wrapper.get(kind, key, callback);
  }

  all(kind: interfaces.DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    this.wrapper.all(kind, callback);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this.wrapper.init(allData, callback);
  }

  delete(kind: interfaces.DataKind, key: string, version: number, callback: () => void): void {
    this.wrapper.delete(kind, key, version, callback);
  }

  upsert(kind: interfaces.DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this.wrapper.upsert(kind, data, callback);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    this.wrapper.initialized(callback);
  }

  close(): void {
    this.wrapper.close();
  }

  getDescription?(): string {
    return this.wrapper.getDescription();
  }
}
