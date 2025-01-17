import { LDClientContext } from '@launchdarkly/node-server-sdk';

import LDRedisOptions from './LDRedisOptions';
import RedisFeatureStore from './RedisFeatureStore';

/**
 * Configures a feature store backed by a Redis instance.
 *
 * For more details about how and why you can use a persistent feature store, see
 * the [Using Redis as a persistent feature store](https://docs.launchdarkly.com/sdk/features/storing-data/redis#nodejs-server-side).
 *
 * ```
 * const redisStoreFactory = RedisFeatureStoreFactory(
 *   {
 *     redisOpts: { host: 'redishost', port: 6379 },
 *     prefix: 'app1',
 *     cacheTTL: 30
 *   });
 * ```
 *
 * @param options Optional configuration, please refer to {@link LDRedisOptions}.
 *
 * @returns
 *   A factory function suitable for use in the SDK configuration (LDOptions).
 */
export default function RedisFeatureStoreFactory(
  options?: LDRedisOptions,
  localFeatureStore?: any,
) {
  return (config: LDClientContext) =>
    new RedisFeatureStore(options, config.basicConfiguration.logger, localFeatureStore);
}
