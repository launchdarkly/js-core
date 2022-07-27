// import { DataCollection, DataKind, FullDataSet, KeyedItems, PersistentDataStore, PersistentDataStoreBase, PersistentDataStoreNonAtomic, VersionedData } from '../../src/api/interfaces';
// import { LDFeatureStoreDataStorage } from '../../src/api/subsystems';

// class MockPersistentStore implements PersistentDataStoreBase {
//   public data: LDFeatureStoreDataStorage = {};
//   public initialized: boolean = false;
//   public getAllError = false;
//   public upsertError: Error | undefined;
//   public closed = false;

//   getInternal(kind: DataKind, key: string, callback: (res: VersionedData | undefined | null) => void): void {
//     callback(this.data[kind.namespace][key] as VersionedData);
//   }

//   getAllInternal(kind: DataKind, callback: (res: KeyedItems<VersionedData> | undefined | null) => void): void {
//     if (this.getAllError) {
//       callback(null);
//     }

//     callback(this.getAllError ? null : this.data[kind.namespace]! as KeyedItems<VersionedData>);
//   }

//   upsertInternal(
//     kind: DataKind,
//     item: VersionedData,
//     callback: (err: Error | null | undefined, finalItem: VersionedData | undefined | null) => void
//   ): void {
//     if (this.upsertError) {
//       callback(this.upsertError, null);
//       return;
//     }
//     const oldItem = this.data[kind.namespace][item.key];
//     if (oldItem && oldItem.version >= item.version) {
//       callback(null, oldItem as VersionedData);
//     } else {
//       this.data[kind.namespace][item.key] = item;
//       callback(null, item);
//     }
//   }

//   initializedInternal(callback: (isInitialized: boolean) => void): void {
//     callback(this.initialized);
//   }

//   close(): void {
//     this.closed = true;
//   }
// }

// class MockPersistentStoreAtomic extends MockPersistentStore implements PersistentDataStore {
//   initInternal(allData: FullDataSet<VersionedData>, callback: () => void): void {
//     this.data = allData;
//     callback();
//   }
// }

// class MockPersistentStoreNonAtomic extends MockPersistentStore implements PersistentDataStoreNonAtomic {
//   initOrderedInternal(allData: DataCollection<VersionedData>[], callback: () => void): void {
//     throw new Error('Method not implemented.');
//   }
// }
