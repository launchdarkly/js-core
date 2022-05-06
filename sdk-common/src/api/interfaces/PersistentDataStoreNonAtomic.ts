import { DataCollection } from './DataCollection';
import { VersionedData } from './VersionedData';

/**
 * Interface for a simplified subset of the functionality of `LDFeatureStore`, to be used in
 * conjunction with `CachingStoreWrapper`.
 *
 * This is a variant of [[PersistentDataStore]] for databases that require somewhat different
 * initialization semantics, where we must specify a consistent ordering of writes.
 *
 * @see [[PersistentDataStore]]
 */

export interface PersistentDataStoreNonAtomic {
  /**
   * Initialize the store, overwriting any existing data.
   *
   * @param allData
   *   A list of data item collections in the order they should be written.
   *
   * @param callback
   *   Will be called when the store has been initialized.
   */
  initOrderedInternal(allData: Array<DataCollection<VersionedData>>, callback: () => void): void;
}
