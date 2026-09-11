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

import LDRedisOptions from './LDRedisOptions';
import RedisClientState from './RedisClientState';
import RedisCore from './RedisCore';
import TtlFromOptions from './TtlFromOptions';

/**
 * Integration between the LaunchDarkly SDK and Redis.
 */
export default class RedisFeatureStore implements LDFeatureStore {
  private _wrapper: PersistentDataStoreWrapper;

  constructor(options?: LDRedisOptions, logger?: LDLogger) {
    this._wrapper = new PersistentDataStoreWrapper(
      new RedisCore(new RedisClientState(options, logger), logger),
      TtlFromOptions(options),
      logger,
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

  init(allData: LDFeatureStoreDataStorage, callback: (err?: Error) => void): void {
    this._wrapper.init(allData, callback);
  }

  delete(kind: interfaces.DataKind, key: string, version: number, callback: () => void): void {
    this._wrapper.delete(kind, key, version, callback);
  }

  upsert(
    kind: interfaces.DataKind,
    data: LDKeyedFeatureStoreItem,
    callback: (err?: Error) => void,
  ): void {
    this._wrapper.upsert(kind, data, callback);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    this._wrapper.initialized(callback);
  }

  isStoreAvailable(callback: (isAvailable: boolean) => void): void {
    if (this._wrapper.isStoreAvailable) {
      this._wrapper.isStoreAvailable(callback);
      return;
    }
    // No availability check on the wrapped core. Report unavailable so recovery
    // falls back to the next successful write instead of a probe that can never
    // report true.
    callback(false);
  }

  close(): void {
    this._wrapper.close();
  }

  getDescription?(): string {
    return this._wrapper.getDescription();
  }
}
