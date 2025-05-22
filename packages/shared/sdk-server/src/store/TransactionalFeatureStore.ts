import { internal } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
  LDTransactionalFeatureStore,
} from '../api/subsystems';
import InMemoryFeatureStore from './InMemoryFeatureStore';

/**
 * This decorator can take a non-transactional {@link LDFeatureStore} implementation
 * and adapt it to be transactional through the use of an in-memory store acting as
 * cache.
 */
export default class TransactionalFeatureStore implements LDTransactionalFeatureStore {
  private _memoryStore: LDTransactionalFeatureStore;
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
    initMetadata?: internal.InitMetadata,
    selector?: string,
  ): void {
    this._memoryStore.applyChanges(
      basis,
      data,
      () => {
        // TODO: SDK-1047 conditional propgation to persistence based on parameter
        if (basis) {
          // basis causes memory store to become the active store
          this._activeStore = this._memoryStore;

          this._nonTransPersistenceStore.init(data, callback);
        } else {
          const params: { dataKind: DataKind; item: LDKeyedFeatureStoreItem }[] = [];
          Object.entries(data).forEach(([namespace, items]) => {
            Object.keys(items || {}).forEach((key) => {
              params.push({ dataKind: { namespace }, item: { key, ...items[key] } });
            });
          });

          params
            .reduce(
              (previousPromise, nextParams) =>
                previousPromise.then(
                  () =>
                    new Promise((resolve) => {
                      this._nonTransPersistenceStore.upsert(
                        nextParams.dataKind,
                        nextParams.item,
                        resolve,
                      );
                    }),
                ),
              Promise.resolve(),
            )
            .then(callback);
        }
      },
      initMetadata,
      selector,
    );
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
