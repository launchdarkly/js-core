import { internal } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../interfaces';
import { LDFeatureStoreDataStorage, LDKeyedFeatureStoreItem } from './LDFeatureStore';

type InitMetadata = internal.InitMetadata;

/**
 * Interface that a data source implementation will use to push data into the SDK.
 *
 * The data source interacts with this object, rather than manipulating the data store directly, so
 * that the SDK can perform any other necessary operations that must happen when data is updated.
 */
export interface LDTransactionalDataSourceUpdates {
  /**
   * Completely overwrites the current contents of the data store with a set of items for each
   * collection.
   *
   * @param allData
   *   An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   *   the value is an object that maps keys to entities. The actual type of this parameter is
   *   `interfaces.FullDataSet<VersionedData>`.
   *
   * @param callback
   *   Will be called when the store has been initialized.
   *
   * @param initMetadata
   *   Optional metadata to initialize the data source with.
   */
  init(allData: LDFeatureStoreDataStorage, callback: () => void, initMetadata?: InitMetadata): void;

  /**
   * Updates or inserts an item in the specified collection. For updates, the object will only be
   * updated if the existing version is less than the new version.
   *
   * @param kind
   *   The type of data to be accessed. The actual type of this parameter is
   *   {@link interfaces.DataKind}.
   *
   * @param data
   *   The contents of the entity, as an object that can be converted to JSON. The store
   *   should check the `version` property of this object, and should *not* overwrite any
   *   existing data if the existing `version` is greater than or equal to that value.
   *   The actual type of this parameter is {@link interfaces.VersionedData}.
   *
   * @param callback
   *   Will be called after the upsert operation is complete.
   */
  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void;

  /**
   * @param basis If true, completely overwrites the current contents of the data store
   * with the provided data.  If false, upserts the items in the provided data.  Upserts
   * are made only if provided items have newer versions than existing items.
   * @param data An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   * the value is an object that maps keys to entities. The actual type of this parameter is
   * `interfaces.FullDataSet<VersionedData>`.
   * @param callback Will be called after the changes are applied.
   * @param initMetadata Optional metadata to initialize the data source with.
   * @param selector opaque string that uniquely identifies the state that contains the changes
   */
  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: InitMetadata,
    selector?: String,
  ): void;
}
