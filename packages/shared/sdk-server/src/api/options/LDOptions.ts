import { LDClientContext, LDLogger, subsystem, VoidFunction } from '@launchdarkly/js-sdk-common';

import { Hook } from '../../integrations/EvaluationHook';
import { LDDataSourceUpdates, LDFeatureStore } from '../subsystems';
import { LDBigSegmentsOptions } from './LDBigSegmentsOptions';
import { LDProxyOptions } from './LDProxyOptions';
import { LDTLSOptions } from './LDTLSOptions';

/**
 * LaunchDarkly initialization options.
 */
export interface LDOptions {
  /**
   * The base URI for the LaunchDarkly server.
   *
   * Most users should use the default value.
   */
  baseUri?: string;

  /**
   * The base URI for the LaunchDarkly streaming server.
   *
   * Most users should use the default value.
   */
  streamUri?: string;

  /**
   * The base URI for the LaunchDarkly events server.
   *
   * Most users should use the default value.
   */
  eventsUri?: string;

  /**
   * The connection timeout, in seconds.
   */
  timeout?: number;

  /**
   * The capacity of the analytics events queue.
   *
   * The client buffers up to this many events in memory before flushing. If the capacity is
   * exceeded before the buffer is flushed, events will be discarded.
   */
  capacity?: number;

  /**
   * Configures a logger for warnings and errors generated by the SDK.
   *
   * The logger can be any object that conforms to the {@link LDLogger} interface.
   * For a simple implementation that lets you filter by log level, see
   * {@link basicLogger}. You can also use an instance of `winston.Logger` from
   * the Winston logging package.
   *
   * If you do not set this property, the SDK uses {@link basicLogger} with a
   * minimum level of `info`.
   */
  logger?: LDLogger;

  /**
   * A component that stores feature flags and related data received from LaunchDarkly.
   *
   * By default, this is an in-memory data structure. Database integrations are also
   * available, as described in the
   * [SDK features guide](https://docs.launchdarkly.com/sdk/concepts/data-stores).
   *
   * Some implementations provide the store implementation object itself, while others
   * provide a factory function that creates the store implementation based on the SDK
   * configuration; this property accepts either.
   */
  featureStore?: LDFeatureStore | ((clientContext: LDClientContext) => LDFeatureStore);

  /**
   * Additional parameters for configuring the SDK's Big Segments behavior.
   *
   * Big Segments are a specific type of user segments. For more information, read the
   * LaunchDarkly documentation: https://docs.launchdarkly.com/home/users/big-segments
   *
   * By default, there is no configuration and Big Segments cannot be evaluated. In this
   * case, any flag evaluation that references a Big Segment will behave as if no users
   * are included in any Big Segments, and the {@link LDEvaluationReason} associated with any
   * such flag evaluation will have a `bigSegmentsStatus` of `"NOT_CONFIGURED"`.
   */
  bigSegments?: LDBigSegmentsOptions;

  /**
   * A component that obtains feature flag data and puts it in the feature store.
   *
   * By default, this is the client's default streaming or polling component.
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
   * The interval in between flushes of the analytics events queue, in seconds.
   */
  flushInterval?: number;

  /**
   * The time between polling requests, in seconds. Ignored in streaming mode.
   */
  pollInterval?: number;

  /**
   * Allows you to specify configuration for an optional HTTP proxy.
   */
  proxyOptions?: LDProxyOptions;

  /**
   * Whether the client should be initialized in offline mode.
   */
  offline?: boolean;

  /**
   * Whether streaming mode should be used to receive flag updates.
   *
   * This is true by default. If you set it to false, the client will use polling.
   * Streaming should only be disabled on the advice of LaunchDarkly support.
   */
  stream?: boolean;

  /**
   * Sets the initial reconnect delay for the streaming connection, in seconds.
   *
   * The streaming service uses a backoff algorithm (with jitter) every time the connection needs
   * to be reestablished. The delay for the first reconnection will start near this value, and then
   * increase exponentially for any subsequent connection failures.
   *
   * The default value is 1.
   */
  streamInitialReconnectDelay?: number;

  /**
   * Whether you are using the LaunchDarkly relay proxy in daemon mode.
   *
   * In this configuration, the client will not connect to LaunchDarkly to get feature flags,
   * but will instead get feature state from a database (Redis or another supported feature
   * store integration) that is populated by the relay. By default, this is false.
   */
  useLdd?: boolean;

  /**
   * Whether to send analytics events back to LaunchDarkly. By default, this is true.
   */
  sendEvents?: boolean;

  /**
   * Whether all context attributes (except the contexy key) should be marked as private, and
   * not sent to LaunchDarkly.
   *
   * By default, this is false.
   */
  allAttributesPrivate?: boolean;

  /**
   * The names of any context attributes that should be marked as private, and not sent
   * to LaunchDarkly.
   */
  privateAttributes?: Array<string>;

  /**
   * The number of context keys that the event processor can remember at any one time,
   * so that duplicate context details will not be sent in analytics events.
   *
   * Defaults to 1000.
   */
  contextKeysCapacity?: number;

  /**
   * The interval (in seconds) at which the event processor will reset its set of
   * known context keys.
   *
   * Defaults to 300.
   */
  contextKeysFlushInterval?: number;

  /**
   * Additional parameters to pass to the Node HTTPS API for secure requests.  These can include any
   * of the TLS-related parameters supported by `https.request()`, such as `ca`, `cert`, and `key`.
   *
   * For more information, see the Node documentation for `https.request()` and `tls.connect()`.
   */
  tlsParams?: LDTLSOptions;

  /**
   * Set to true to opt out of sending diagnostics data.
   *
   * Unless the `diagnosticOptOut` field is set to true, the client will send some diagnostics data
   * to the LaunchDarkly servers in order to assist in the development of future SDK improvements.
   * These diagnostics consist of an initial payload containing some details of SDK in use, the
   * SDK's configuration, and the platform the SDK is being run on, as well as payloads sent
   * periodically with information on irregular occurrences such as dropped events.
   */
  diagnosticOptOut?: boolean;

  /**
   * The interval at which periodic diagnostic data is sent, in seconds.
   *
   * The default is 900 (every 15 minutes) and the minimum value is 60 (every minute).
   */
  diagnosticRecordingInterval?: number;

  /**
   * For use by wrapper libraries to set an identifying name for the wrapper being used.
   *
   * This will be sent in User-Agent headers during requests to the LaunchDarkly servers to allow
   * recording metrics on the usage of these wrapper libraries.
   */
  wrapperName?: string;

  /**
   * For use by wrapper libraries to report the version of the library in use.
   *
   * If `wrapperName` is not set, this field will be ignored. Otherwise the version string will be
   * included in the User-Agent headers along with the `wrapperName` during requests to the
   * LaunchDarkly servers.
   */
  wrapperVersion?: string;

  /**
   * Information about the application where the LaunchDarkly SDK is running.
   *
   * Note that this config option may be renamed to applicationInfo in a future major version
   * to be consistent with other SDKs.
   */
  application?: {
    /**
     * A unique identifier representing the application where the LaunchDarkly SDK is running.
     *
     * This can be specified as any string value as long as it only uses the following characters:
     * ASCII letters, ASCII digits, period, hyphen, underscore. A string containing any other
     * characters will be ignored.
     *
     * Example: `authentication-service`
     */
    id?: string;

    /**
     * A unique identifier representing the version of the application where the LaunchDarkly SDK is
     * running.
     *
     * This can be specified as any string value as long as it only uses the following characters:
     * ASCII letters, ASCII digits, period, hyphen, underscore. A string containing any other
     * characters will be ignored.
     *
     * Example: `1.0.0` (standard version string) or `abcdef` (sha prefix)
     */
    version?: string;

    /**
     * A human-friendly application name representing the application where the LaunchDarkly SDK is running.
     *
     * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
     * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
     */
    name?: string;

    /**
     * A human-friendly name representing the version of the application where the LaunchDarkly SDK is running.
     *
     * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
     * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
     */
    versionName?: string;
  };

  hooks?: Hook[];
}
