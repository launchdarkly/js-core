import { LDClientContext } from '@launchdarkly/node-server-sdk';
import DynamoDBFeatureStore from './DynamoDBFeatureStore';
import LDDynamoDBOptions from './LDDynamoDBOptions';

/**
 * Configures a feature store backed by a DynamoDB instance.
 *
 * For more details about how and why you can use a persistent feature store, see
 * the [Using DynamoDB as a persistent feature store](https://docs.launchdarkly.com/sdk/features/storing-data/dynamodb#nodejs-server-side).
 *
 * @param tableName The table name in DynamoDB (required). The table must already exist.
 *   See: https://docs.launchdarkly.com/sdk/features/storing-data/dynamodb
 * @param options Optional configuration, please refer to {@link LDDynamoDBOptions}.
 *
 * @returns
 *   A factory function suitable for use in the SDK configuration (LDOptions).
 */
export default function DynamoDBFeatureStoreFactory(
  tableName: string,
  options?: LDDynamoDBOptions
) {
  return (config: LDClientContext) =>
    new DynamoDBFeatureStore(tableName, options, config.basicConfiguration.logger);
}
