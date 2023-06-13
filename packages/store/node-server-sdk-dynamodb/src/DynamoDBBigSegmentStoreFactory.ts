import { LDOptions, interfaces } from '@launchdarkly/node-server-sdk';
import LDDynamoDBOptions from './LDDynamoDBOptions';
import DynamoDBBigSegmentStore from './DynamoDBBigSegmentStore';

/**
 * Configures a big segment store factory backed by a DynamoDB instance.
 *
 * "Big segments" are a specific type of user segments. For more information, read the
 * LaunchDarkly documentation about user segments: https://docs.launchdarkly.com/home/users/segments
 *
 * @param tableName The table name in DynamoDB (required). The table must already exist.
 *   See: https://docs.launchdarkly.com/sdk/features/storing-data/dynamodb
 * @param options Optional configuration (required), please refer to {@link LDDynamoDBOptions}.
 *
 * @returns A function which creates big segment stores based on the provided config.
 */
export default function DynamoDBBigSegmentStoreFactory(
  tableName: string,
  options?: LDDynamoDBOptions
): (config: LDOptions) => interfaces.BigSegmentStore {
  return (config: LDOptions) => new DynamoDBBigSegmentStore(tableName, options, config.logger);
}
