import { DataKind } from '../api/interfaces';
import { LDDataSourceUpdates, LDFeatureStore, LDFeatureStoreDataStorage, LDKeyedFeatureStoreItem } from '../api/subsystems';

export default class DataSourceUpdates implements LDDataSourceUpdates {
  constructor(private readonly featureStore: LDFeatureStore) {
    
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this.featureStore.init(allData, callback);
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this.featureStore.upsert(kind, data, callback);
  }
}