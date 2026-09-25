import { LDClientContext } from '@launchdarkly/js-sdk-common';

import { LDFeatureStore, LDOverrideSource } from '../subsystems';

/**
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

  /**
   * Configuration for the SDK's FDv1 Fallback Synchronizer.
   *
   * The FDv1 Fallback Synchronizer is engaged only in response to a server-directed FDv1
   * Fallback Directive (the `x-ld-fd-fallback: true` response header) -- it is independent
   * of the FDv2 initializer/synchronizer chain configured via {@link dataSource}.
   *
   * If omitted, the SDK uses sensible defaults derived from the rest of the configuration.
   * If explicitly set to `null`, no FDv1 fallback synchronizer is configured and the SDK
   * will transition to a terminal Closed state when the directive is received.
   */
  fdv1Fallback?: FDv1FallbackConfiguration | null;

  /**
   * Configures an override source. Flag overrides are currently experimental and subject to
   * change.
   *
   * The source supplies flag and segment definitions that take precedence over data received
   * from LaunchDarkly on a per-key basis. Overrides let an operator force one or more flags to a
   * known state on a running client, whether or not the client can reach LaunchDarkly. Flags not
   * present in the override data are unaffected.
   *
   * The override source is not a data source. It has no effect on the client's initialization
   * status or data source status. Configuring it changes nothing until the source supplies an
   * override. At most one override source can be configured.
   *
   * Some implementations provide the source object itself, while others provide a factory
   * function that creates the source based on the SDK configuration. This property accepts
   * either.
   */
  overrides?: LDOverrideSourceOptions;
}

/**
 * Configuration of the file-based override source. Flag overrides are currently experimental and
 * subject to change.
 *
 * The source reads flag and segment overrides from one or more local files and reloads them as
 * the files change. The files use the same document format as the file data source: a JSON or
 * YAML document with optional `flags`, `flagValues`, and `segments` members. `flagValues` entries
 * expand into full flag definitions that return the given value for every context.
 *
 * A configured file that does not exist contributes no overrides. It can be created later, and
 * deleting it removes its overrides. A file that exists but cannot be read or parsed fails that
 * reload: the previously loaded overrides stay in effect, the failure is logged, and the source
 * retries. Every applied change is logged at Info level with the overrides in effect and what
 * each file supplied.
 *
 * @example
 * ```typescript
 * const client = init(sdkKey, {
 *   dataSystem: {
 *     overrides: { type: 'file', paths: ['/etc/launchdarkly/overrides.json'] },
 *   },
 * });
 * ```
 */
export interface FileOverrideSourceOptions {
  type: 'file';

  /**
   * The paths of the files to read, in precedence order. At least one path is required. The
   * order decides which file wins under the duplicate keys handling when the same key appears in
   * more than one file.
   */
  paths: string[];

  /**
   * What to do when the same flag or segment key appears in more than one file. `fail`, the
   * default, treats the reload as failed and keeps the previously loaded overrides. `ignore`
   * keeps the entry from the first configured file that defines the key and discards the others.
   */
  duplicateKeysHandling?: 'fail' | 'ignore';

  /**
   * How the source detects file changes. The two modes are alternatives.
   *
   * `polling`, the default, examines the files on a fixed interval and reloads when the
   * modification time or the size of a file changes. It works on every filesystem, including
   * network mounts and directories whose contents are swapped through symbolic links.
   *
   * `watching` reloads in response to filesystem change notifications for the directories that
   * contain the files. It reacts faster than polling. It depends on notifications, which some
   * filesystems do not deliver reliably.
   */
  changeDetection?: 'polling' | 'watching';

  /**
   * The interval between examinations of the files in polling mode, in seconds. The default is
   * 1. An interval below 1 is raised to 1. Watching mode ignores it.
   */
  pollInterval?: number;

  /**
   * A YAML parser for YAML files. The parser must produce the same structure as `JSON.parse`.
   * The Node.js SDK supplies one by default. Other platforms need one to read YAML files.
   */
  yamlParser?: (data: string) => any;
}

/**
 * The ways an override source can be configured: the file-based source, a source object, or a
 * factory function that creates a source from the client context.
 *
 * Flag overrides are currently experimental and subject to change.
 */
export type LDOverrideSourceOptions =
  | FileOverrideSourceOptions
  | LDOverrideSource
  | ((clientContext: LDClientContext) => LDOverrideSource);

export function isFileOverrideSourceOptions(u: any): u is FileOverrideSourceOptions {
  return typeof u === 'object' && u !== null && u.type === 'file';
}

/**
 * Configuration options for the FDv1 Fallback Synchronizer.
 */
export interface FDv1FallbackConfiguration {
  /**
   * Override the polling base URI used by the FDv1 Fallback Synchronizer. Defaults to the
   * SDK's configured polling base URI.
   */
  baseUri?: string;
  /**
   * The interval between polls, in seconds. Defaults to the SDK's configured pollInterval.
   */
  pollInterval?: number;
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
   * Optional per-source base URI for this streaming data source. When set, this source
   * connects to the given URI instead of the SDK's shared streaming service endpoint.
   * Defaults to the SDK's configured streaming base URI.
   */
  baseUri?: string;

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
   * Optional per-source base URI for this polling data source. When set, this source
   * polls the given URI instead of the SDK's shared polling service endpoint.
   * Defaults to the SDK's configured polling base URI.
   */
  baseUri?: string;
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
// baseUri is omitted here: standard mode always uses Configuration.serviceEndpoints and has
// no per-source override, unlike the same field on a CustomDataSourceOptions initializer.
export interface StandardDataSourceOptions
  extends
    Omit<StreamingDataSourceConfiguration, 'type' | 'baseUri'>,
    Omit<PollingDataSourceConfiguration, 'type' | 'baseUri'> {
  dataSourceOptionsType: 'standard';
}

/**
 * This data source will make best effort to maintain a streaming connection to LaunchDarkly services
 * to provide real time data updates.
 */
// baseUri omitted for the same reason as StandardDataSourceOptions above
export interface StreamingDataSourceOptions extends Omit<
  StreamingDataSourceConfiguration,
  'type' | 'baseUri'
> {
  dataSourceOptionsType: 'streamingOnly';
}

/**
 * This data source will periodically make a request to LaunchDarkly services to retrieve updated data.
 */
// baseUri omitted for the same reason as StandardDataSourceOptions above
export interface PollingDataSourceOptions extends Omit<
  PollingDataSourceConfiguration,
  'type' | 'baseUri'
> {
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
 * This data source will allow developers to define their own composite data source.
 *
 * The following example is roughly equivilent to using the {@link StandardDataSourceOptions} with the default values.
 * @example
 * ```typescript
 * dataSource: {
 *  dataSourceOptionsType: 'custom',
 *  initializers: [
 *     {
 *      type: 'polling'
 *    },
 *  ],
 *  synchronizers: [
 *    {
 *      type: 'streaming',
 *    },
 *    {
 *      type: 'polling',
 *    }
 *  ],
 * }
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
