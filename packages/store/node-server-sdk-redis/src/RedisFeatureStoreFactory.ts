import { LDClientContext } from '@launchdarkly/node-server-sdk';
import RedisFeatureStore from './RedisFeatureStore';
import LDRedisOptions from './LDRedisOptions';

export default function RedisFeatureStoreFactory(options?: LDRedisOptions) {
  return (config: LDClientContext) => {
    return new RedisFeatureStore(options, config.basicConfiguration.logger);
  }
}