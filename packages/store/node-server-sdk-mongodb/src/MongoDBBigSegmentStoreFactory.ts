import { interfaces, LDClientContext } from '@launchdarkly/node-server-sdk';

import LDMongoDBOptions from './LDMongoDBOptions';
import MongoDBBigSegmentStore from './MongoDBBigSegmentStore';

/**
 * Configures a big segment store factory backed by a MongoDB instance.
 *
 * "Big segments" are a specific type of user segments. For more information, read the
 * LaunchDarkly documentation about user segments: https://docs.launchdarkly.com/home/users/segments
 *
 * @param options Optional MongoDB configuration options including connection URI, database name,
 *   collection prefix, and other MongoDB-specific settings.
 *
 * @returns A function which creates big segment stores based on the provided config.
 *
 * @example
 * ```typescript
 * import { init } from '@launchdarkly/node-server-sdk';
 * import { MongoDBBigSegmentStore } from '@launchdarkly/node-server-sdk-mongodb';
 *
 * const client = init('your-sdk-key', {
 *   bigSegments: {
 *     store: MongoDBBigSegmentStore({
 *       uri: 'mongodb://localhost:27017',
 *       database: 'launchdarkly',
 *       prefix: 'ld_'
 *     })
 *   }
 * });
 * ```
 */
export default function MongoDBBigSegmentStoreFactory(
  options?: LDMongoDBOptions,
): (config: LDClientContext) => interfaces.BigSegmentStore {
  return (config: LDClientContext) =>
    new MongoDBBigSegmentStore(options, config?.basicConfiguration.logger);
}