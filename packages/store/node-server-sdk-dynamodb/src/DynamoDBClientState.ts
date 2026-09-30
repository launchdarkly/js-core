import {
  AttributeValue,
  BatchWriteItemCommand,
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  PutItemCommandInput,
  QueryCommand,
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

// The AWS SDK does not set a request timeout by default, so a request on a dead
// connection can wait on TCP for many minutes. The SDK serializes its store
// writes, and one hung request delays every later write and blocks the
// recovery write-back. Three layers bound every call:
// - connectionTimeout covers the TCP connect phase, which the older handler's
//   requestTimeout does not cover.
// - requestTimeout makes an unresponsive peer fail after the connection is up.
// - A per-call abort signal is a wall-clock backstop for the shapes the handler
//   timers miss, such as a reply that trickles bytes or a stall after the
//   response headers on newer handlers. Its deadline leaves room for the AWS
//   SDK's default three attempts, so it fires only when the timers did not.
// The handler defaults also apply when the user passes clientOptions without a
// requestHandler. A user-supplied requestHandler or dynamoDBClient keeps its
// own handler configuration, but every call still gets the abort backstop.
// Passing configuration in place of a handler instance requires
// @aws-sdk/client-dynamodb 3.521.0; the peer dependency floor matches.
const CONNECTION_TIMEOUT_MS = 10000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const CALL_DEADLINE_MS = 100000;

function defaultRequestHandler() {
  return {
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    requestTimeout: DEFAULT_REQUEST_TIMEOUT_MS,
    // Without throwOnRequestTimeout, newer handler versions only log a
    // warning when the deadline passes and the request keeps waiting.
    throwOnRequestTimeout: true,
  };
}

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
      // Keep the timeout defaults unless the user supplies a handler. Most
      // configurations pass only credentials, a region, or an endpoint, and
      // without the defaults one hung request would block the store queue.
      this._client = new DynamoDBClient({
        requestHandler: defaultRequestHandler(),
        ...options.clientOptions,
      });
      this._owned = true;
    } else {
      this._client = new DynamoDBClient({
        requestHandler: defaultRequestHandler(),
      });
      this._owned = true;
    }
  }

  /**
   * Per-call options for every send. The abort signal is the wall-clock
   * backstop described on the timeout constants above.
   */
  private _callOptions() {
    return { abortSignal: AbortSignal.timeout(CALL_DEADLINE_MS) };
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
    // Paginate manually instead of with paginateQuery. The paginator has no
    // way to pass per-call options, and every call needs the abort backstop.
    let lastEvaluatedKey: Record<string, AttributeValue> | undefined;
    do {
      // Pages of one query are inherently sequential.
      // eslint-disable-next-line no-await-in-loop
      const page = await this._client.send(
        new QueryCommand({ ...params, ExclusiveStartKey: lastEvaluatedKey }),
        this._callOptions(),
      );
      if (page.Items) {
        records.push(...page.Items);
      }
      lastEvaluatedKey = page.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return records;
  }

  async batchWrite(table: string, params: WriteRequest[]) {
    const batches: WriteRequest[][] = [];
    // Split into batches of at most 25 commands.
    for (let i = 0; i < params.length; i += WRITE_BATCH_SIZE) {
      batches.push(params.slice(i, i + WRITE_BATCH_SIZE));
    }

    // Write the batches strictly in order, and finish retrying a batch's
    // unprocessed items before advancing. The caller orders the items so that
    // prerequisites come before their dependents, and a deferred item written
    // after a later batch would break that order for concurrent readers. This
    // also means no request is in flight after a failure is reported.
    for (const batch of batches) {
      let pending = batch;
      // The first attempt writes the whole batch. Each retry writes only the
      // items that DynamoDB returned as unprocessed.
      for (
        let attempt = 0;
        attempt <= MAX_UNPROCESSED_RETRIES && pending.length > 0;
        attempt += 1
      ) {
        if (attempt > 0) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(UNPROCESSED_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        }
        // eslint-disable-next-line no-await-in-loop
        const result = await this._client.send(
          new BatchWriteItemCommand({
            RequestItems: { [table]: pending },
          }),
          this._callOptions(),
        );
        pending = result.UnprocessedItems?.[table] ?? [];
      }
      if (pending.length > 0) {
        throw new Error(
          `DynamoDB batch write returned ${pending.length} unprocessed item(s) after ${MAX_UNPROCESSED_RETRIES} retries`,
        );
      }
    }
  }

  async get(
    table: string,
    key: Record<string, AttributeValue>,
    consistentRead: boolean = false,
  ): Promise<Record<string, AttributeValue> | undefined> {
    const res = await this._client.send(
      new GetItemCommand({
        TableName: table,
        Key: key,
        ConsistentRead: consistentRead,
      }),
      this._callOptions(),
    );
    return res.Item;
  }

  async put(params: PutItemCommandInput): Promise<void> {
    try {
      await this._client.send(new PutItemCommand(params), this._callOptions());
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
      this._callOptions(),
    );
  }

  close() {
    if (this._owned) {
      this._client.destroy();
    }
  }
}
