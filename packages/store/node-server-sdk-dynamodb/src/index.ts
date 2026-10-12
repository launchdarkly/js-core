// Exporting the factories without the 'Factory'. This keeps them in-line with
// previous store versions. The differentiation between the factory and the store
// is not critical for consuming the SDK.

import DynamoDBBigSegmentStore from './DynamoDBBigSegmentStoreFactory';
import DynamoDBFeatureStore from './DynamoDBFeatureStoreFactory';

export { DynamoDBFeatureStore, DynamoDBBigSegmentStore };

export { default as LDDynamoDBOptions } from './LDDynamoDBOptions';
