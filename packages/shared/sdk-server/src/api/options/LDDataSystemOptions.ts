import { LDClientContext, subsystem } from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates, LDFeatureStore } from '../subsystems';

/**
 * Configuration options for the Data System that the SDK uses to get and maintain flags and other
 * data from LaunchDarkly and other sources.
 *
 * Example (Recommended):
 * ```typescript
 * let dataSystemOptions = {
 *     dataSource: {
 *         type: 'standard';
 *     },
 * }
 *
 * Example (Polling with DynamoDB Persistent Store):
 * ```typescript
 * import { DynamoDBFeatureStore } from '@launchdarkly/node-server-sdk-dynamodb';
 *
 * let dataSystemOptions = {
 *     dataSource: {
 *         type: 'polling';
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
   * pefroms a combination of streaming and polling.
   *
   * See {@link LDDataSystemOptions} decoumentation for exmaples.
   */
  dataSource?: DataSourceOptions;

  /**
   * A component that obtains feature flag data and puts it in the feature store. Setting
   * this supercedes {@link LDDataSystemOptions#dataSource}.
   */
  updateProcessor?:
    | object
    | ((
        clientContext: LDClientContext,
        dataSourceUpdates: LDDataSourceUpdates,
        initSuccessHandler: VoidFunction,
        errorHandler?: (e: Error) => void,
      ) => subsystem.LDStreamProcessor);

  /**
   * Before data has arrived from LaunchDarkly, the SDK is able to evaluate flags using
   * data from the persistent store. Once fresh data is available, the SDK will no longer
   * read from the persistent store, although it will keep it up-to-date for future startups.
   */
  persistentStore?: LDFeatureStore | ((clientContext: LDClientContext) => LDFeatureStore);
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
  type: 'standard';

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
  type: 'streaming';

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
  type: 'polling';

  /**
   * The time between polling requests, in seconds. Default if omitted.
   */
  pollInterval?: number;
}

export function isStandardOptions(u: any): u is StandardDataSourceOptions {
  return u.kind === 'standard';
}

export function isStreamingOptions(u: any): u is StreamingDataSourceOptions {
  return u.kind === 'streaming';
}

export function isPollingOptions(u: any): u is PollingDataSourceOptions {
  return u.kind === 'polling';
}
