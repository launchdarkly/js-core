// Exporting the factories without the 'Factory'. This keeps them in-line with
// previous store versions. The differentiation between the factory and the store
// is not critical for consuming the SDK.

import RedisBigSegmentStore from './RedisBigSegmentStoreFactory';
import RedisFeatureStore from './RedisFeatureStoreFactory';

export { RedisFeatureStore, RedisBigSegmentStore };

export { default as LDRedisOptions } from './LDRedisOptions';
