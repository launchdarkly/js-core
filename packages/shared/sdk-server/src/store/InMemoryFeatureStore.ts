import { DataKind } from '../api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';

export default class InMemoryFeatureStore implements LDFeatureStore {
  private _allData: LDFeatureStoreDataStorage = {};

  // this tracks the last received selector, which may not be present
  private _selector: string | undefined;

  private _initCalled = false;

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
    const result: LDFeatureStoreKindData = {};
    const items = this._allData[kind.namespace] ?? {};
    Object.entries(items).forEach(([key, item]) => {
      if (item && !item.deleted) {
        result[key] = item;
      }
    });
    callback?.(result);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this.applyChanges(true, allData, callback, undefined);
  }

  delete(kind: DataKind, key: string, version: number, callback: () => void): void {
    const item: LDKeyedFeatureStoreItem = { key, version, deleted: true };
    this.applyChanges(
      false,
      {
        [kind.namespace]: {
          [key]: item,
        },
      },
      callback,
      undefined,

    );
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this.applyChanges(
      false,
      {
        [kind.namespace]: {
          [data.key]: data,
        },
      },
      callback,
      undefined,
    );
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    selector?: string,
  ): void {
    if (basis) {
      this._initCalled = true;
      this._allData = data;
    } else {
      const tempData: LDFeatureStoreDataStorage = {};
      // shallow copy to protect against concurrent read
      Object.entries(this._allData).forEach(([namespace, items]) => {
        tempData[namespace] = { ...items };
      });

      Object.entries(data).forEach(([namespace, items]) => {
        Object.keys(items || {}).forEach((key) => {
          let existingItems = tempData[namespace];
          if (!existingItems) {
            existingItems = {};
            tempData[namespace] = existingItems;
          }
          const item = items[key];
          if (Object.hasOwnProperty.call(existingItems, key)) {
            const old = existingItems[key];
            // TODO: SDK-1046 - Determine if version check should be removed
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

  /* eslint-disable class-methods-use-this */
  close(): void {
    // For the memory store this is a no-op.
  }

  getDescription(): string {
    return 'memory';
  }

  getSelector(): string | undefined {
    return this._selector;
  }
}
