import { DataKind } from '../api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';
import promisify from '../async/promisify';

/**
 * Provides an async interface to a feature store.
 *
 * This allows for using a store using async/await instead of callbacks.
 *
 */
export default class AsyncStoreFacade {
  private _store: LDFeatureStore;

  constructor(store: LDFeatureStore) {
    this._store = store;
  }

  async get(kind: DataKind, key: string): Promise<LDFeatureStoreItem | null> {
    return promisify((cb) => {
      this._store.get(kind, key, cb);
    });
  }

  async all(kind: DataKind): Promise<LDFeatureStoreKindData> {
    return promisify((cb) => {
      this._store.all(kind, cb);
    });
  }

  async init(allData: LDFeatureStoreDataStorage): Promise<void> {
    return promisify((cb) => {
      this._store.init(allData, cb);
    });
  }

  async delete(kind: DataKind, key: string, version: number): Promise<void> {
    return promisify((cb) => {
      this._store.delete(kind, key, version, cb);
    });
  }

  async upsert(kind: DataKind, data: LDKeyedFeatureStoreItem): Promise<void> {
    return promisify((cb) => {
      this._store.upsert(kind, data, cb);
    });
  }

  async initialized(): Promise<boolean> {
    return promisify((cb) => {
      this._store.initialized(cb);
    });
  }

  async applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    selector?: string,
  ): Promise<void> {
    return promisify((cb) => {
      this._store.applyChanges(basis, data, cb, selector);
    });
  }

  close(): void {
    this._store.close();
  }
}
