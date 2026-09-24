import {
  AttributeValue,
  BatchWriteItemCommand,
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  paginateQuery,
  PutItemCommand,
  PutItemCommandInput,
  QueryCommandInput,
  WriteRequest,
} from '@aws-sdk/client-dynamodb';

import LDDynamoDBOptions from './LDDynamoDBOptions';

// Unlike some other database integrations where the key prefix is mandatory and has
// a default value, in DynamoDB it is fine to not have a prefix. If there is one, we
// prepend it to keys with a ':' separator.
const DEFAULT_PREFIX = '';

// BatchWrite can only accept 25 items at a time, so split up the writes into batches of 25.
const WRITE_BATCH_SIZE = 25;

// DynamoDB can return unprocessed items when it throttles a batch write.
// Retry the unprocessed items a limited number of times with exponential
// backoff. Report a failure if items remain unprocessed after the retries.
const MAX_UNPROCESSED_RETRIES = 3;
const UNPROCESSED_RETRY_BASE_DELAY_MS = 100;

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Class for managing the state of a dynamodb client.
 *
 * Used for the dynamodb persistent store as well as the dynamodb big segment store.
 *
 * @internal
 */
export default class DynamoDBClientState {
  // This will include the ':' if a prefix is set.
  private _prefix: string;

  private _client: DynamoDBClient;

  private _owned: boolean;

  constructor(options?: LDDynamoDBOptions) {
    this._prefix = options?.prefix ? `${options.prefix}:` : DEFAULT_PREFIX;

    // We track if we own the client so that we can destroy clients that we own.
    if (options?.dynamoDBClient) {
      this._client = options.dynamoDBClient;
      this._owned = false;
    } else if (options?.clientOptions) {
      this._client = new DynamoDBClient(options.clientOptions);
      this._owned = true;
    } else {
      this._client = new DynamoDBClient({});
      this._owned = true;
    }
  }

  /**
   * Get a key with prefix prepended.
   * @param key The key to prefix.
   * @returns The prefixed key.
   */
  prefixedKey(key: string): string {
    return `${this._prefix}${key}`;
  }

  async query(params: QueryCommandInput): Promise<Record<string, AttributeValue>[]> {
    const records: Record<string, AttributeValue>[] = [];
    // Using a generator here is a substantial ergonomic improvement.
    for await (const page of paginateQuery({ client: this._client }, params)) {
      if (page.Items) {
        records.push(...page.Items);
      }
    }
    return records;
  }

  async batchWrite(table: string, params: WriteRequest[]) {
    let pending = params;
    // The first attempt writes all the items. Each retry writes only the
    // items that DynamoDB returned as unprocessed.
    for (let attempt = 0; attempt <= MAX_UNPROCESSED_RETRIES && pending.length > 0; attempt += 1) {
      if (attempt > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(UNPROCESSED_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
      // eslint-disable-next-line no-await-in-loop
      pending = await this._writeBatches(table, pending);
    }
    if (pending.length > 0) {
      throw new Error(
        `DynamoDB batch write returned ${pending.length} unprocessed item(s) after ${MAX_UNPROCESSED_RETRIES} retries`,
      );
    }
  }

  private async _writeBatches(table: string, requests: WriteRequest[]): Promise<WriteRequest[]> {
    const batches: WriteRequest[][] = [];
    // Split into batches of at most 25 commands.
    for (let i = 0; i < requests.length; i += WRITE_BATCH_SIZE) {
      batches.push(requests.slice(i, i + WRITE_BATCH_SIZE));
    }

    // Execute all the batches and wait for them to complete.
    const results = await Promise.all(
      batches.map((batch) =>
        this._client.send(
          new BatchWriteItemCommand({
            RequestItems: { [table]: batch },
          }),
        ),
      ),
    );

    // Collect the items that DynamoDB did not process.
    const unprocessed: WriteRequest[] = [];
    results.forEach((result) => {
      const items = result.UnprocessedItems?.[table];
      if (items) {
        unprocessed.push(...items);
      }
    });
    return unprocessed;
  }

  async get(
    table: string,
    key: Record<string, AttributeValue>,
  ): Promise<Record<string, AttributeValue> | undefined> {
    const res = await this._client.send(
      new GetItemCommand({
        TableName: table,
        Key: key,
      }),
    );
    return res.Item;
  }

  async put(params: PutItemCommandInput): Promise<void> {
    try {
      await this._client.send(new PutItemCommand(params));
    } catch (err) {
      // If we couldn't upsert because of the version, then that is fine.
      // Otherwise we return failure.
      if (!(err instanceof ConditionalCheckFailedException)) {
        throw err;
      }
    }
  }

  async delete(table: string, key: Record<string, AttributeValue>): Promise<void> {
    await this._client.send(
      new DeleteItemCommand({
        TableName: table,
        Key: key,
      }),
    );
  }

  close() {
    if (this._owned) {
      this._client.destroy();
    }
  }
}
