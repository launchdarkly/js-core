// Exporting the factories without the 'Factory'. This keeps them in-line with
// previous store versions. The differentiation between the factory and the store
// is not critical for consuming the SDK.
export { default as RedisFeatureStore } from './RedisFeatureStoreFactory';
export { default as RedisBigSegmentStore } from './RedisBigSegmentStoreFactory';

export { default as LDRedisOptions } from './LDRedisOptions';
