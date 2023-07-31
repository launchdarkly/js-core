import { DataKind } from '../api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';

export default class InMemoryFeatureStore implements LDFeatureStore {
  private allData: LDFeatureStoreDataStorage = {};

  private initCalled = false;

  private addItem(kind: DataKind, key: string, item: LDFeatureStoreItem) {
    let items = this.allData[kind.namespace];
    if (!items) {
      items = {};
      this.allData[kind.namespace] = items;
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
    const items = this.allData[kind.namespace];
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
    const items = this.allData[kind.namespace] ?? {};
    Object.entries(items).forEach(([key, item]) => {
      if (item && !item.deleted) {
        result[key] = item;
      }
    });
    callback?.(result);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this.initCalled = true;
    this.allData = allData as LDFeatureStoreDataStorage;
    callback?.();
  }

  delete(kind: DataKind, key: string, version: number, callback: () => void): void {
    const deletedItem = { version, deleted: true };
    this.addItem(kind, key, deletedItem);
    callback?.();
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this.addItem(kind, data.key, data);
    callback?.();
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    return callback?.(this.initCalled);
  }

  /* eslint-disable class-methods-use-this */
  close(): void {
    // For the memory store this is a no-op.
  }

  getDescription(): string {
    return 'memory';
  }
}
