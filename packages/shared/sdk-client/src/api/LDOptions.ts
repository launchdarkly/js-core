import type { LDLogger } from '@launchdarkly/js-sdk-common';

import { Hook } from './integrations/Hooks';
import { LDInspection } from './LDInspection';

export interface LDOptions {
  /**
   * Whether all context attributes (except the context key) should be marked as private, and
   * not sent to LaunchDarkly in analytics events.
   *
   * @defaultValue false.
   */
  allAttributesPrivate?: boolean;

  /**
   * Information about the application the LaunchDarkly SDK is running in.
   *
   * These properties are optional and informational. They may be used in LaunchDarkly
   * analytics or other product features.
   */
  applicationInfo?: {
    /**
     * A unique identifier representing the application where the LaunchDarkly SDK is running.
     *
     * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
     * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
     *
     * Example: `authentication-service`
     */
    id?: string;
    /**
     * A unique identifier representing the version of the application where the LaunchDarkly SDK is running.
     *
     * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
     * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
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

  /**
   * The base uri for the LaunchDarkly server. Most users should use the default value.
   *
   * @defaultValue https://clientsdk.launchdarkly.com.
   */
  baseUri?: string;

  /**
   * The capacity of the analytics events queue.
   *
   * The client buffers up to this many events in memory before flushing. If the capacity is exceeded
   * before the queue is flushed, events will be discarded. Increasing the capacity means that events
   * are less likely to be discarded, at the cost of consuming more memory. Note that in regular usage
   * flag evaluations do not produce individual events, only summary counts, so you only need a large
   * capacity if you are generating a large number of click, pageview, or identify events (or if you
   * are using the event debugger).
   *
   * @defaultValue 100.
   */
  capacity?: number;

  /**
   * Enables debug logging.
   *
   * @defaultValue false.
   */
  debug?: boolean;

  /**
   * Set to true to opt out of sending diagnostics data.
   *
   * Unless `diagnosticOptOut` is set to true, the client will send some diagnostics data to the LaunchDarkly
   * servers in order to assist in the development of future SDK improvements. These diagnostics consist of
   * an initial payload containing some details of SDK in use, the SDK's configuration, and the platform the
   * SDK is being run on, as well as payloads sent periodically with information on irregular occurrences such
   * as dropped events.
   *
   * @defaultValue false.
   */
  diagnosticOptOut?: boolean;

  /**
   * The interval at which periodic diagnostic data is sent, in seconds.
   *
   * The default is 900 (every 15 minutes) and the minimum value is 6. See {@link diagnosticOptOut}
   * for more information on the diagnostics data being sent.
   *
   * @defaultValue 900s.
   */
  diagnosticRecordingInterval?: number;

  /**
   * The base uri for the LaunchDarkly events server. Most users should use the default value.
   *
   * @defaultValue https://events.launchdarkly.com.
   */
  eventsUri?: string;

  /**
   * The interval in between flushes of the analytics events queue, in seconds.
   *
   * @defaultValue 2s for browser implementations 30s for others.
   */
  flushInterval?: number;

  /**
   * An object that will perform logging for the client.
   *
   * @remarks
   * Set a custom {@link LDLogger} if you want full control of logging behavior.
   *
   * @defaultValue The default logging implementation will varybased on platform. For the browser
   * the default logger will log "info" level and higher priorty messages and it will log messages to
   * console.info, console.warn, and console.error. Other platforms may use a `BasicLogger` instance
   * also defaulted to the "info" level.
   */
  logger?: LDLogger;

  /**
   * The maximum number of locally cached contexts.  The cache is used to decrease initialization
   * latency and to provide fallback when the SDK cannot reach LaunchDarkly services.
   *
   * @defaultValue 5
   */
  maxCachedContexts?: number;

  /**
   * Specifies a list of attribute names (either built-in or custom) which should be marked as
   * private, and not sent to LaunchDarkly in analytics events. You can also specify this on a
   * per-context basis with {@link LDContextMeta.privateAttributes}.
   *
   * Any contexts sent to LaunchDarkly with this configuration active will have attributes with
   * these names removed in analytic events. This is in addition to any attributes that were
   * marked as private for an individual context with {@link LDContextMeta.privateAttributes}.
   * Setting {@link LDOptions.allAttributesPrivate} to true overrides this.
   *
   * If and only if a parameter starts with a slash, it is interpreted as a slash-delimited path
   * that can denote a nested property within a JSON object. For instance, "/address/street" means
   * that if there is an attribute called "address" that is a JSON object, and one of the object's
   * properties is "street", the "street" property will be redacted from the analytics data but
   * other properties within "address" will still be sent. This syntax also uses the JSON Pointer
   * convention of escaping a literal slash character as "~1" and a tilde as "~0".
   */
  privateAttributes?: Array<string>;

  /**
   * Whether to send analytics events back to LaunchDarkly.
   *
   * @defaultValue true.
   */
  sendEvents?: boolean;

  /**
   * Sets the initial reconnect delay for the streaming connection, in seconds.
   *
   * The streaming service uses a backoff algorithm (with jitter) every time the connection needs
   * to be reestablished. The delay for the first reconnection will start near this value, and then
   * increase exponentially for any subsequent connection failures.
   *
   * @defaultValue 1s.
   */
  streamInitialReconnectDelay?: number;

  /**
   * The base uri for the LaunchDarkly streaming server. Most users should use the default value.
   *
   * @defaultValue https://clientstream.launchdarkly.com.
   */
  streamUri?: string;

  /**
   * The time between polling requests, in seconds. Ignored in streaming mode.
   *
   * The minimum polling interval is 30 seconds.
   */
  pollInterval?: number;

  /**
   * Directs the SDK to use the REPORT method for HTTP requests instead of GET. (Default: `false`)
   *
   * This setting applies both to requests to the streaming service, as well as flag requests when the SDK is in polling
   * mode.
   */
  useReport?: boolean;

  /**
   * Whether LaunchDarkly should provide additional information about how flag values were
   * calculated.
   *
   * The additional information will then be available through the client's
   * {@link LDClient.variationDetail} method. Since this increases the size of network requests,
   * such information is not sent unless you set this option to true.
   *
   * @defaultValue false.
   */
  withReasons?: boolean;

  /**
   * For use by wrapper libraries to set an identifying name for the wrapper being used.
   *
   * This will be sent as diagnostic information to the LaunchDarkly servers to allow recording
   * metrics on the usage of these wrapper libraries.
   */
  wrapperName?: string;

  /**
   * For use by wrapper libraries to set version to be included alongside `wrapperName`.
   *
   * If `wrapperName` is unset, this field will be ignored.
   */
  wrapperVersion?: string;

  /**
   * LaunchDarkly Server SDKs historically downloaded all flag configuration and segments for a particular environment
   * during initialization.
   *
   * For some customers, this is an unacceptably large amount of data, and has contributed to performance issues
   * within their products.
   *
   * Filtered environments aim to solve this problem. By allowing customers to specify subsets of an environment's
   * flags using a filter key, SDKs will initialize faster and use less memory.
   *
   * This payload filter key only applies to the default streaming and polling data sources. It will not affect
   * TestData or FileData data sources, nor will it be applied to any data source provided through the featureStore
   * config property.
   */
  payloadFilterKey?: string;

  /**
   * Initial set of hooks for the client.
   *
   * Hooks provide entrypoints which allow for observation of SDK functions.
   *
   * LaunchDarkly provides integration packages, and most applications will not
   * need to implement their own hooks. Refer to the `@launchdarkly/node-server-sdk-otel`
   * for instrumentation for the `@launchdarkly/node-server-sdk`.
   *
   * Example:
   * ```typescript
   * import { init } from '@launchdarkly/node-server-sdk';
   * import { TheHook } from '@launchdarkly/some-hook';
   *
   * const client = init('my-sdk-key', { hooks: [new TheHook()] });
   * ```
   */
  hooks?: Hook[];

  /**
   * Inspectors can be used for collecting information for monitoring, analytics, and debugging.
   *
   *
   * @deprecated Hooks should be used instead of inspectors and inspectors will be removed in
   * a future version. If you need functionality that is not exposed using hooks, then please
   * let us know through a github issue or support.
   */
  inspectors?: LDInspection[];

  /**
   * Whether to clean old persistent data. If set to true, the SDK will check to see if old
   * there are any persistent data that is generated by an older version and remove it.
   *
   * @defaultValue false.
   */
  cleanOldPersistentData?: boolean;
}
