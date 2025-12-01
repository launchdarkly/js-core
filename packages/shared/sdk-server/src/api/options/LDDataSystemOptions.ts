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
   * {@link StreamingDataSourceOptions}, {@link PollingDataSourceOptions}, or {@link CustomDataSourceOptions}; setting the
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
  | PollingDataSourceOptions
  | CustomDataSourceOptions;

export type DataSourceConfiguration =
  | FileSystemDataSourceConfiguration
  | StreamingDataSourceConfiguration
  | PollingDataSourceConfiguration;

export interface FileSystemDataSourceConfiguration {
  type: 'file';
  /**
   * The paths to the files to read data from.
   */
  paths: Array<string>;
  /**
   * A function to parse the data from the file.
   */
  yamlParser?: (data: string) => any;
}

export interface StreamingDataSourceConfiguration {
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

export interface PollingDataSourceConfiguration {
  type: 'polling';
  /**
   * The time between polling requests, in seconds. Default if omitted.
   */
  pollInterval?: number;
}

/**
 * This standard data source is the recommended datasource for most customers. It will use
 * a combination of streaming and polling to initialize the SDK, provide real time updates,
 * and can switch between streaming and polling automatically to provide redundancy.
 */
export interface StandardDataSourceOptions
  extends
    Omit<StreamingDataSourceConfiguration, 'type'>,
    Omit<PollingDataSourceConfiguration, 'type'> {
  dataSourceOptionsType: 'standard';
}

/**
 * This data source will make best effort to maintain a streaming connection to LaunchDarkly services
 * to provide real time data updates.
 */
export interface StreamingDataSourceOptions extends Omit<StreamingDataSourceConfiguration, 'type'> {
  dataSourceOptionsType: 'streamingOnly';
}

/**
 * This data source will periodically make a request to LaunchDarkly services to retrieve updated data.
 */
export interface PollingDataSourceOptions extends Omit<PollingDataSourceConfiguration, 'type'> {
  dataSourceOptionsType: 'pollingOnly';
}

/**
 * Initializer configuration options
 */
export type InitializerDataSource =
  | FileSystemDataSourceConfiguration
  | PollingDataSourceConfiguration;

/**
 * Synchronizer configuration options
 */
export type SynchronizerDataSource =
  | PollingDataSourceConfiguration
  | StreamingDataSourceConfiguration;

/**
 * This data source will allow developers to define their own composite data source
 */
export interface CustomDataSourceOptions {
  dataSourceOptionsType: 'custom';

  /**
   * Ordered list of {@link InitializerDataSource} that will run in order. The first
   * initializer that successfully returns a valid payload will transition the sdk
   * out of intialization stage into the synchronization stage.
   */
  initializers: Array<InitializerDataSource>;

  /**
   * Order list of {@link SynchronizerDataSource} in priority order. Datasources will
   * failover to the next datasource in this array until there are no datasources left
   * to run.
   */
  synchronizers: Array<SynchronizerDataSource>;
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

export function isCustomOptions(u: any): u is CustomDataSourceOptions {
  return u.dataSourceOptionsType === 'custom';
}
