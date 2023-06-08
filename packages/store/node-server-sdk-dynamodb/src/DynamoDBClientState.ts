import { LDDynamoDBOptions } from './LDDynamoDBOptions';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LDLogger } from '@launchdarkly/node-server-sdk';

// Unlike some other database integrations where the key prefix is mandatory and has
// a default value, in DynamoDB it is fine to not have a prefix. If there is one, we
// prepend it to keys with a ':' separator.
const DEFAULT_PREFIX = '';


/**
 * Class for managing the state of a dynamodb client.
 *
 * Used for the dynamodb persistent store as well as the dynamodb big segment store.
 *
 * @internal
 */
export default class DynamoDBClientState {
  // This will include the ':' if a prefix is set.
  private prefix: string;

  private client: DynamoDBClient;

  constructor(options: LDDynamoDBOptions, logger?: LDLogger) {
    this.prefix = options?.prefix ? `${options!.prefix}:` : DEFAULT_PREFIX;

    if(options.dynamoDBClient) {
      this.client = options.dynamoDBClient;
    } else if(options.clientOptions) {
      this.client = new DynamoDBClient(options!.clientOptions);
    } else {
      // TODO: Kaboom
    }

    // Unlike some other database integrations, we don't need to keep track of whether we
    // created our own client so as to shut it down later; the AWS client is stateless.
  }

  /**
   * Get a key with prefix prepended.
   * @param key The key to prefix.
   * @returns The prefixed key.
   */
  prefixedKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}