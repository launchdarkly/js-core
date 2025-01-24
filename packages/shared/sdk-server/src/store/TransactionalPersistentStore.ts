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
    this.applyChanges(true, allData, undefined, callback);
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
      undefined,
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
      undefined,
      callback,
    );
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    selector: String | undefined, // TODO: SDK-1044 - Utilize selector
    callback: () => void,
  ): void {
    this._memoryStore.applyChanges(basis, data, selector, () => {
      // TODO: SDK-1047 conditional propgation to persistence based on parameter
      this._nonTransPersistenceStore.applyChanges(basis, data, selector, callback);
    });

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
