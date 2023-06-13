// Exporting the factories without the 'Factory'. This keeps them in-line with
// previous store versions. The differentiation between the factory and the store
// is not critical for consuming the SDK.
export { default as DynamoDBFeatureStore } from './DynamoDBFeatureStoreFactory';
export { default as DynamoDBBigSegmentStore } from './DynamoDBBigSegmentStoreFactory';

export { default as LDDynamoDBOptions } from './LDDynamoDBOptions';
