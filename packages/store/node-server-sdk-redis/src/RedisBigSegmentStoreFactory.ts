import { LDOptions, interfaces } from '@launchdarkly/node-server-sdk';
import LDRedisOptions from './LDRedisOptions';
import RedisBigSegmentStore from './RedisBigSegmentStore';

/**
 * Configures a big segment store factory backed by a Redis instance.
 *
 * "Big segments" are a specific type of user segments. For more information, read the
 * LaunchDarkly documentation about user segments: https://docs.launchdarkly.com/home/users/segments
 *
 * @param options The standard options supported for all LaunchDarkly Redis features, including both
 *   options for Redis itself and others related to the SDK's behavior.
 *
 * @returns A function which creates big segment stores based on the provided config.
 */
export default function RedisBigSegmentStoreFactory(
  options?: LDRedisOptions,
): (config: LDOptions) => interfaces.BigSegmentStore {
  return (config: LDOptions) => new RedisBigSegmentStore(options, config.logger);
}
