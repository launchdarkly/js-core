import { interfaces, LDClientContext } from '@launchdarkly/node-server-sdk';

import DynamoDBBigSegmentStore from './DynamoDBBigSegmentStore';
import LDDynamoDBOptions from './LDDynamoDBOptions';

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
  options?: LDDynamoDBOptions,
): (config: LDClientContext) => interfaces.BigSegmentStore {
  return (config: LDClientContext) =>
    new DynamoDBBigSegmentStore(tableName, options, config.basicConfiguration.logger);
}
