import {
  AttributeValue,
  BatchWriteItemCommand,
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  ProvisionedThroughputExceededException,
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

// DynamoDB can return unprocessed items when it throttles a batch write, or
// reject the whole batch when the table is over its provisioned throughput.
// Retry both shapes with jittered exponential backoff. The budget gives a
// table with modest provisioned capacity time to drain one batch between
// attempts. A short budget fails the write, and each later recovery attempt
// rewrites the full data set, which consumes still more capacity. Report a
// failure if items remain unprocessed after the retries.
const MAX_UNPROCESSED_RETRIES = 10;
const UNPROCESSED_RETRY_BASE_DELAY_MS = 100;
const UNPROCESSED_RETRY_MAX_DELAY_MS = 5000;

/**
 * Compute the backoff before the given retry attempt.
 *
 * The delay doubles from the base and is capped. The random jitter keeps the
 * second half of each delay, so retries from multiple SDK instances spread
 * out instead of repeatedly hitting the table at the same time.
 */
function unprocessedRetryDelayMs(attempt: number): number {
  const delayMs = Math.min(
    UNPROCESSED_RETRY_MAX_DELAY_MS,
    UNPROCESSED_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
  );
  return delayMs / 2 + Math.random() * (delayMs / 2);
}

// The AWS SDK does not set a request timeout by default, so a request on a dead
// connection can wait on TCP for many minutes. The SDK serializes its store
// writes, and one hung request delays every later write and blocks the
// recovery write-back. Three layers bound every call:
// - connectionTimeout covers the TCP connect phase, which the older handler's
//   requestTimeout does not cover.
// - requestTimeout makes an unresponsive peer fail after the connection is up.
// - A per-call abort signal bounds the total elapsed time of a call. It covers
//   the shapes the handler timers miss, such as a reply that trickles bytes or
//   a stall after the response headers on newer handlers. Node timers follow
//   the monotonic clock, so a system clock change does not move the deadline. It also caps the total time across the
//   AWS SDK's retry attempts, so a fully used retry budget can end slightly
//   early rather than hang.
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
        ...options.clientOptions,
        // The ?? also catches a requestHandler key that is explicitly
        // undefined, which a plain spread would let erase the defaults.
        requestHandler: options.clientOptions.requestHandler ?? defaultRequestHandler(),
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
   * Run one client call with the total-elapsed-time backstop described on the
   * timeout constants above.
   *
   * The controller and timer are explicit, and the timer is cleared as soon as
   * the call settles. An AbortSignal.timeout signal would be simpler, but old
   * request handlers never remove their abort listener, and a timeout signal
   * with a listener is held in memory until its timer fires. That retained
   * every completed request for the full deadline. AbortSignal.timeout also
   * does not exist on the oldest supported Node versions.
   */
  private async _withDeadline<T>(
    call: (options: { abortSignal?: AbortSignal }) => Promise<T>,
  ): Promise<T> {
    if (typeof AbortController === 'undefined') {
      // A runtime this old has no abort support. It loses only the backstop;
      // the request handler timeouts still apply.
      return call({});
    }
    const controller = new AbortController();
    let deadlinePassed = false;
    const timer = setTimeout(() => {
      deadlinePassed = true;
      controller.abort();
    }, CALL_DEADLINE_MS);
    timer.unref();
    try {
      return await call({ abortSignal: controller.signal });
    } catch (err) {
      if (deadlinePassed && (err as Error)?.name === 'AbortError') {
        // The handler reports only "Request aborted". Say why.
        throw new Error(`The DynamoDB request did not complete within ${CALL_DEADLINE_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
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
    // Paginate manually instead of with paginateQuery. The paginator has no
    // way to pass per-call options, and every call needs the abort backstop.
    // Start from the caller's start key so the first page is not rewound.
    let lastEvaluatedKey = params.ExclusiveStartKey;
    do {
      // Pages of one query are inherently sequential.
      // eslint-disable-next-line no-await-in-loop
      const page = await this._withDeadline((callOptions) =>
        this._client.send(
          new QueryCommand({ ...params, ExclusiveStartKey: lastEvaluatedKey }),
          callOptions,
        ),
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
          await sleep(unprocessedRetryDelayMs(attempt));
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await this._withDeadline((callOptions) =>
            this._client.send(
              new BatchWriteItemCommand({
                RequestItems: { [table]: pending },
              }),
              callOptions,
            ),
          );
          pending = result.UnprocessedItems?.[table] ?? [];
        } catch (err) {
          // A throughput rejection is the every-item-unprocessed shape of the
          // same throttling, so it shares the retry budget. The last attempt
          // reports the rejection itself. Other errors are not retried.
          if (
            !(err instanceof ProvisionedThroughputExceededException) ||
            attempt === MAX_UNPROCESSED_RETRIES
          ) {
            throw err;
          }
        }
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
    const res = await this._withDeadline((callOptions) =>
      this._client.send(
        new GetItemCommand({
          TableName: table,
          Key: key,
          ConsistentRead: consistentRead,
        }),
        callOptions,
      ),
    );
    return res.Item;
  }

  async put(params: PutItemCommandInput): Promise<void> {
    try {
      await this._withDeadline((callOptions) =>
        this._client.send(new PutItemCommand(params), callOptions),
      );
    } catch (err) {
      // If we couldn't upsert because of the version, then that is fine.
      // Otherwise we return failure.
      if (!(err instanceof ConditionalCheckFailedException)) {
        throw err;
      }
    }
  }

  async delete(table: string, key: Record<string, AttributeValue>): Promise<void> {
    await this._withDeadline((callOptions) =>
      this._client.send(
        new DeleteItemCommand({
          TableName: table,
          Key: key,
        }),
        callOptions,
      ),
    );
  }

  close() {
    if (this._owned) {
      this._client.destroy();
    }
  }
}
