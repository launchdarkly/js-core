import { internal } from '@launchdarkly/js-sdk-common';

import { LDFeatureStore, LDFeatureStoreDataStorage } from './LDFeatureStore';

/**
 * Transactional version of {@link LDFeatureStore} with support for {@link applyChanges}
 */
export interface LDTransactionalFeatureStore extends LDFeatureStore {
  /**
   * Applies the provided data onto the existing data, replacing all data or upserting depending
   * on the basis parameter.  Must call {@link applyChanges} providing basis before calling {@link applyChanges}
   * that is not a basis.
   *
   * @param basis If true, completely overwrites the current contents of the data store
   * with the provided data.  If false, upserts the items in the provided data.  Upserts
   * are made only if provided items have newer versions than existing items.
   * @param data An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   * the value is an object that maps keys to entities. The actual type of this parameter is
   * `interfaces.FullDataSet<VersionedData>`.
   * @param callback Will be called after the changes are applied.
   * @param initMetadata Optional metadata to initialize the feature store with.
   * @param selector opaque string that uniquely identifies the state that contains the changes
   */
  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: internal.InitMetadata,
    selector?: String,
  ): void;

  /**
   * Gets the selector for the currently stored data.
   */
  getSelector?(): string | undefined;
}
