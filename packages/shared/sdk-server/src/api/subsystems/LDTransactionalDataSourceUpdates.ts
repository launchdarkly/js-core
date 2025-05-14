import { internal } from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates } from './LDDataSourceUpdates';
import { LDFeatureStoreDataStorage } from './LDFeatureStore';

type InitMetadata = internal.InitMetadata;

/**
 * @experimental
 * This feature is not stable and not subject to any backwards compatibility guarantees or semantic
 * versioning.  It is not suitable for production usage.
 *
 * Transactional version of {@link LDDataSourceUpdates} with support for {@link applyChanges}
 */
export interface LDTransactionalDataSourceUpdates extends LDDataSourceUpdates {
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
