import { LDClientContext } from '@launchdarkly/node-server-sdk';

import LDMongoDBOptions from './LDMongoDBOptions';
import MongoDBFeatureStore from './MongoDBFeatureStore';

/**
 * Configures a feature store backed by a MongoDB instance.
 *
 * For more details about how and why you can use a persistent feature store, see
 * the [Using MongoDB as a persistent feature store](https://docs.launchdarkly.com/sdk/features/storing-data) documentation.
 *
 * @example
 * ```typescript
 * import { init } from '@launchdarkly/node-server-sdk';
 * import { MongoDBFeatureStore } from '@launchdarkly/node-server-sdk-mongodb';
 *
 * const client = init('your-sdk-key', {
 *   featureStore: MongoDBFeatureStore({
 *     uri: 'mongodb://localhost:27017',
 *     database: 'launchdarkly',
 *     prefix: 'ld_',
 *     cacheTTL: 30
 *   })
 * });
 * ```
 *
 * @param options Optional MongoDB configuration options including connection URI, database name,
 *   collection prefix, cache TTL, and other MongoDB-specific settings.
 *
 * @returns A factory function suitable for use in the SDK configuration (LDOptions).
 */
export default function MongoDBFeatureStoreFactory(options?: LDMongoDBOptions) {
  return (config: LDClientContext) =>
    new MongoDBFeatureStore(options, config.basicConfiguration.logger);
}
