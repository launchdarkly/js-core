import { FullDataSet } from "./FullDataSet";
import { PersistentDataStoreBase } from "./PersistentDataStoreBase";
import { VersionedData } from "./VersionedData";

/**
 * Interface for a simplified subset of the functionality of `LDFeatureStore`, to be used in
 * conjunction with `CachingStoreWrapper`.
 *
 * @see [[PersistentDataStoreNonAtomic]]
 */


export interface PersistentDataStore extends PersistentDataStoreBase {
  /**
   * Initialize the store, overwriting any existing data.
   *
   * @param allData
   *   An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   *   the value is an object that maps keys to entities.
   *
   * @param callback
   *   Will be called when the store has been initialized.
   */
  initInternal(allData: FullDataSet<VersionedData>, callback: () => void): void;
}
