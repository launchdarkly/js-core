import { DataKind } from '../api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';

/**
 * A basic wrapper to make async methods with callbacks into promises.
 *
 * @param method
 * @returns A promisified version of the method.
 */
function promisify<T>(method: (callback: (val: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve) => {
    method((val: T) => { resolve(val); });
  });
}

/**
 * Provides an async interface to a feature store.
 *
 * This allows for using a store using async/await instead of callbacks.
 *
 * @internal
 */
export default class AsyncStoreFacade {
  private store: LDFeatureStore;

  constructor(store: LDFeatureStore) {
    this.store = store;
  }

  async get(kind: DataKind, key: string): Promise<LDFeatureStoreItem | null> {
    return promisify((cb) => {
      this.store.get(kind, key, cb);
    });
  }

  async all(kind: DataKind): Promise<LDFeatureStoreKindData> {
    return promisify((cb) => {
      this.store.all(kind, cb);
    });
  }

  async init(allData: LDFeatureStoreDataStorage): Promise<void> {
    return promisify((cb) => {
      this.store.init(allData, cb);
    });
  }

  async delete(kind: DataKind, key: string, version: number): Promise<void> {
    return promisify((cb) => {
      this.store.delete(kind, key, version, cb);
    });
  }

  async upsert(kind: DataKind, data: LDKeyedFeatureStoreItem): Promise<void> {
    return promisify((cb) => {
      this.store.upsert(kind, data, cb);
    });
  }

  async initialized(): Promise<boolean> {
    return promisify((cb) => {
      this.store.initialized(cb);
    });
  }

  close(): void {
    this.store.close();
  }
}
