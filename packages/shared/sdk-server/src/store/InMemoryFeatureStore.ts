import { internal } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
  LDTransactionalFeatureStore,
} from '../api/subsystems';

// Copies the items into a null-prototype object, so that a key such as __proto__ is an ordinary
// key. Object spread or assignment into an ordinary object sets the prototype for that key.
function copyItems(items: LDFeatureStoreKindData): LDFeatureStoreKindData {
  return Object.assign(Object.create(null), items);
}

export default class InMemoryFeatureStore implements LDTransactionalFeatureStore {
  private _allData: LDFeatureStoreDataStorage = {};

  // this tracks the last received selector, which may not be present
  private _selector: string | undefined;

  private _initCalled = false;

  private _initMetadata?: internal.InitMetadata;

  get(kind: DataKind, key: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    const items = this._allData[kind.namespace];
    if (items) {
      if (Object.prototype.hasOwnProperty.call(items, key)) {
        const item = items[key];
        if (item && !item.deleted) {
          return callback?.(item);
        }
      }
    }
    return callback?.(null);
  }

  all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    // A null-prototype object, so that a flag key such as __proto__ is an ordinary key.
    const result: LDFeatureStoreKindData = Object.create(null);
    const items = this._allData[kind.namespace] ?? {};
    Object.entries(items).forEach(([key, item]) => {
      if (item && !item.deleted) {
        result[key] = item;
      }
    });
    callback?.(result);
  }

  /**
   * Get a snapshot of all data in the store, for every kind, including tombstones for
   * deleted items. The snapshot does not change when the store changes later.
   *
   * This method is for SDK internal use. It supports rewriting the full data set into a
   * persistent store.
   */
  getAllRaw(): LDFeatureStoreDataStorage {
    const snapshot: LDFeatureStoreDataStorage = {};
    Object.entries(this._allData).forEach(([namespace, items]) => {
      snapshot[namespace] = copyItems(items);
    });
    return snapshot;
  }

  init(
    allData: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: internal.InitMetadata,
  ): void {
    this.applyChanges(true, allData, callback, initMetadata);
  }

  delete(kind: DataKind, key: string, version: number, callback: () => void): void {
    const item: LDKeyedFeatureStoreItem = { key, version, deleted: true };
    this._applyChanges(
      false,
      {
        [kind.namespace]: {
          [key]: item,
        },
      },
      callback,
      true,
    );
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this._applyChanges(
      false,
      {
        [kind.namespace]: {
          [data.key]: data,
        },
      },
      callback,
      true,
    );
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: internal.InitMetadata,
    selector?: string,
  ): void {
    this._applyChanges(basis, data, callback, false, initMetadata, selector);
  }

  /**
   * @param checkVersions When true, an item replaces a stored item only if its version is higher.
   * Single upserts and deletes use the item version to keep the updates in order. A change set
   * does not use it: the payload selector keeps change sets in order, and the store applies each
   * item of a change set.
   */
  private _applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    checkVersions: boolean,
    initMetadata?: internal.InitMetadata,
    selector?: string,
  ): void {
    if (basis) {
      this._initCalled = true;
      this._allData = data;
      this._initMetadata = initMetadata;
    } else {
      const tempData: LDFeatureStoreDataStorage = {};
      // shallow copy to protect against concurrent read
      Object.entries(this._allData).forEach(([namespace, items]) => {
        tempData[namespace] = copyItems(items);
      });

      Object.entries(data).forEach(([namespace, items]) => {
        Object.keys(items || {}).forEach((key) => {
          let existingItems = tempData[namespace];
          if (!existingItems) {
            existingItems = Object.create(null);
            tempData[namespace] = existingItems;
          }
          const item = items[key];
          if (checkVersions && Object.hasOwnProperty.call(existingItems, key)) {
            const old = existingItems[key];
            if (!old || old.version < item.version) {
              existingItems[key] = { key, ...item };
            }
          } else {
            existingItems[key] = { key, ...item };
          }
        });
      });

      this._allData = tempData;
    }

    this._selector = selector;

    callback?.();
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    return callback?.(this._initCalled);
  }

  close(): void {
    // For the memory store this is a no-op.
  }

  getDescription(): string {
    return 'memory';
  }

  getInitMetaData(): internal.InitMetadata | undefined {
    return this._initMetadata;
  }

  getSelector(): string | undefined {
    return this._selector;
  }
}
