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

  private _initCalled = false;

  private _addItem(kind: DataKind, key: string, item: LDFeatureStoreItem) {
    let items = this._allData[kind.namespace];
    if (!items) {
      items = {};
      this._allData[kind.namespace] = items;
    }
    if (Object.hasOwnProperty.call(items, key)) {
      const old = items[key];
      if (!old || old.version < item.version) {
        items[key] = item;
      }
    } else {
      items[key] = item;
    }
  }

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
    this.applyChanges(true, allData, undefined, callback);
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
      undefined,
      callback,
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
      undefined,
      callback,
    );
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    selector: String | undefined, // TODO handle selector
    callback: () => void,
  ): void {
    if (basis) {
      this._initCalled = true;
      this._allData = data;
    } else {
      Object.entries(data).forEach(([namespace, items]) => {
        Object.keys(items || {}).forEach((key) => {
          const item = items[key];
          // TODO: optimize this section, perhaps get rid of _addItem
          this._addItem({ namespace }, key, item);
        });
      });
    }

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
}
