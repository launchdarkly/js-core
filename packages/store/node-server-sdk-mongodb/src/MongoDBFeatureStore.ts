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

import LDMongoDBOptions from './LDMongoDBOptions';
import MongoDBClientState from './MongoDBClientState';
import MongoDBCore from './MongoDBCore';
import TtlFromOptions from './TtlFromOptions';

/**
 * Integration between the LaunchDarkly SDK and MongoDB.
 * 
 * This feature store implementation stores LaunchDarkly feature flags and segments
 * in MongoDB collections, providing persistent storage for your feature flag data.
 * 
 * Features:
 * - Automatic collection management based on data kinds (features, segments, etc.)
 * - Optimistic concurrency control using version numbers
 * - Configurable caching with TTL support
 * - Connection pooling and retry logic
 * - Proper cleanup of deleted items during initialization
 */
export default class MongoDBFeatureStore implements LDFeatureStore {
  private _wrapper: PersistentDataStoreWrapper;

  /**
   * Creates a new MongoDB feature store.
   * 
   * @param options MongoDB configuration options
   * @param logger Optional logger instance
   */
  constructor(options?: LDMongoDBOptions, logger?: LDLogger) {
    this._wrapper = new PersistentDataStoreWrapper(
      new MongoDBCore(new MongoDBClientState(options), logger),
      TtlFromOptions(options),
    );
  }

  get(
    kind: interfaces.DataKind,
    key: string,
    callback: (res: LDFeatureStoreItem | null) => void,
  ): void {
    this._wrapper.get(kind, key, callback);
  }

  all(kind: interfaces.DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    this._wrapper.all(kind, callback);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this._wrapper.init(allData, callback);
  }

  delete(kind: interfaces.DataKind, key: string, version: number, callback: () => void): void {
    this._wrapper.delete(kind, key, version, callback);
  }

  upsert(kind: interfaces.DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this._wrapper.upsert(kind, data, callback);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    this._wrapper.initialized(callback);
  }

  close(): void {
    this._wrapper.close();
  }

  getDescription?(): string {
    return this._wrapper.getDescription();
  }
}