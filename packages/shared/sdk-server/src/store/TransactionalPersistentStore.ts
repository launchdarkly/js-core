import { internal } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';
import InMemoryFeatureStore from './InMemoryFeatureStore';

/**
 * This decorator can take a non-transactional {@link LDFeatureStore} implementation
 * and adapt it to be transactional through the use of an in-memory store acting as
 * cache.
 */
export default class TransactionalPersistentStore implements LDFeatureStore {
  private _memoryStore: LDFeatureStore;
  private _activeStore: LDFeatureStore;

  constructor(private readonly _nonTransPersistenceStore: LDFeatureStore) {
    // persistence store is inital active store
    this._activeStore = this._nonTransPersistenceStore;
    this._memoryStore = new InMemoryFeatureStore();
  }

  get(kind: DataKind, key: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    this._activeStore.get(kind, key, callback);
  }

  all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    this._activeStore.all(kind, callback);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    // adapt to applyChanges for common handling
    this.applyChanges(true, allData, callback);
  }

  delete(kind: DataKind, key: string, version: number, callback: () => void): void {
    // adapt to applyChanges for common handling
    const item: LDKeyedFeatureStoreItem = { key, version, deleted: true };
    this.applyChanges(
      false,
      {
        [kind.namespace]: {
          [key]: item,
        },
      },
      callback,
    );
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    // adapt to applyChanges for common handling
    this.applyChanges(
      false,
      {
        [kind.namespace]: {
          [data.key]: data,
        },
      },
      callback,
    );
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    _initMetadata?: internal.InitMetadata, // init metadata is not utilized in the persistence layer
    _selector?: String, // TODO: SDK-1044 - Utilize selector
  ): void {
    this._memoryStore.applyChanges(
      basis,
      data,
      () => {
        // TODO: SDK-1047 conditional propagation to persistence based on parameter
        this._nonTransPersistenceStore.applyChanges(
          basis,
          data,
          callback,
          _initMetadata,
          _selector,
        );
      },
      _initMetadata,
      _selector,
    );

    if (basis) {
      // basis causes memory store to become the active store
      this._activeStore = this._memoryStore;
    }
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    // this is valid because the active store will only switch to the in memory store
    // after it has already been initialized itself
    this._activeStore.initialized(callback);
  }

  close(): void {
    this._nonTransPersistenceStore.close();
    this._memoryStore.close();
  }

  getDescription(): string {
    return 'transactional persistent store';
  }
}
