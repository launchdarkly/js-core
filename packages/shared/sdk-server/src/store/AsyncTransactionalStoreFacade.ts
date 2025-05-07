import { internal } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
  LDTransactionalFeatureStore,
} from '../api/subsystems';
import promisify from '../async/promisify';

type InitMetadata = internal.InitMetadata;

/**
 * Provides an async interface to a feature store.
 *
 * This allows for using a store using async/await instead of callbacks.
 *
 */
export default class AsyncTransactionalStoreFacade {
  private _store: LDTransactionalFeatureStore;

  constructor(store: LDTransactionalFeatureStore) {
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

  async init(allData: LDFeatureStoreDataStorage, initMetadata?: InitMetadata): Promise<void> {
    return promisify((cb) => {
      this._store.init(allData, cb, initMetadata);
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
    initMetadata?: InitMetadata,
    selector?: String,
  ): Promise<void> {
    return promisify((cb) => {
      this._store.applyChanges(basis, data, cb, initMetadata, selector);
    });
  }

  close(): void {
    this._store.close();
  }

  getInitMetadata?(): InitMetadata | undefined {
    return this._store.getInitMetaData?.();
  }
}
