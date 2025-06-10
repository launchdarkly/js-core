import { LDClientContext } from '@launchdarkly/js-sdk-common';

import { LDFeatureStore } from '../subsystems';

/**
 * @experimental
 * This feature is not stable and not subject to any backwards compatibility guarantees or semantic
 * versioning.  It is not suitable for production usage.
 *
 * Configuration options for the Data System that the SDK uses to get and maintain flags and other
 * data from LaunchDarkly and other sources.
 *
 * Example (Recommended):
 * ```typescript
 * let dataSystemOptions = {
 *     dataSource: {
 *         dataSourceOptionsType: 'standard';
 *     },
 * }
 *
 * Example (Polling with DynamoDB Persistent Store):
 * ```typescript
 * import { DynamoDBFeatureStore } from '@launchdarkly/node-server-sdk-dynamodb';
 *
 * let dataSystemOptions = {
 *     dataSource: {
 *         dataSourceOptionsType: 'pollingOnly';
 *         pollInterval: 300;
 *     },
 *     persistentStore: DynamoDBFeatureStore('your-table', { cacheTTL: 30 });
 * }
 * const client = init('my-sdk-key', { hooks: [new TracingHook()] });
 * ```
 */
export interface LDDataSystemOptions {
  /**
   * Configuration options for the Data Source that the SDK uses to get flags and other
   * data from the LaunchDarkly servers. Choose one of {@link StandardDataSourceOptions},
   * {@link StreamingDataSourceOptions}, or {@link PollingDataSourceOptions}; setting the
   * type and the optional fields you want to customize.
   *
   * If not specified, this defaults to using the {@link StandardDataSourceOptions} which
   * performs a combination of streaming and polling.
   *
   * See {@link LDDataSystemOptions} documentation for examples.
   */
  dataSource?: DataSourceOptions;

  /**
   * Before data has arrived from LaunchDarkly, the SDK is able to evaluate flags using
   * data from the persistent store. Once fresh data has arrived from LaunchDarkly, the
   * SDK will no longer read from the persistent store, although it will keep it up-to-date
   * for future startups.
   *
   * Some implementations provide the store implementation object itself, while others
   * provide a factory function that creates the store implementation based on the SDK
   * configuration; this property accepts either.
   *
   * @param clientContext whose properties may be used to influence creation of the persistent store.
   */
  persistentStore?: LDFeatureStore | ((clientContext: LDClientContext) => LDFeatureStore);

  /**
   * Whether you are using the LaunchDarkly relay proxy in daemon mode.
   *
   * In this configuration, the client will not connect to LaunchDarkly to get feature flags,
   * but will instead get feature state from a database (Redis or another supported feature
   * store integration) that is populated by the relay. By default, this is false.
   */
  useLdd?: boolean;
}

export type DataSourceOptions =
  | StandardDataSourceOptions
  | StreamingDataSourceOptions
  | PollingDataSourceOptions;

/**
 * This standard data source is the recommended datasource for most customers. It will use
 * a combination of streaming and polling to initialize the SDK, provide real time updates,
 * and can switch between streaming and polling automatically to provide redundancy.
 */
export interface StandardDataSourceOptions {
  dataSourceOptionsType: 'standard';

  /**
   * Sets the initial reconnect delay for the streaming connection, in seconds. Default if omitted.
   *
   * The streaming service uses a backoff algorithm (with jitter) every time the connection needs
   * to be reestablished. The delay for the first reconnection will start near this value, and then
   * increase exponentially for any subsequent connection failures.
   *
   * The default value is 1.
   */
  streamInitialReconnectDelay?: number;

  /**
   * The time between polling requests, in seconds. Default if omitted.
   */
  pollInterval?: number;
}

/**
 * This data source will make best effort to maintain a streaming connection to LaunchDarkly services
 * to provide real time data updates.
 */
export interface StreamingDataSourceOptions {
  dataSourceOptionsType: 'streamingOnly';

  /**
   * Sets the initial reconnect delay for the streaming connection, in seconds. Default if omitted.
   *
   * The streaming service uses a backoff algorithm (with jitter) every time the connection needs
   * to be reestablished. The delay for the first reconnection will start near this value, and then
   * increase exponentially up to a maximum for any subsequent connection failures.
   *
   * The default value is 1.
   */
  streamInitialReconnectDelay?: number;
}

/**
 * This data source will periodically make a request to LaunchDarkly services to retrieve updated data.
 */
export interface PollingDataSourceOptions {
  dataSourceOptionsType: 'pollingOnly';

  /**
   * The time between polling requests, in seconds. Default if omitted.
   */
  pollInterval?: number;
}

export function isStandardOptions(u: any): u is StandardDataSourceOptions {
  return u.dataSourceOptionsType === 'standard';
}

export function isStreamingOnlyOptions(u: any): u is StreamingDataSourceOptions {
  return u.dataSourceOptionsType === 'streamingOnly';
}

export function isPollingOnlyOptions(u: any): u is PollingDataSourceOptions {
  return u.dataSourceOptionsType === 'pollingOnly';
}
