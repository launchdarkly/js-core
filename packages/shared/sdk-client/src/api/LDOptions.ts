import type { LDFlagSet, LDLogger } from '@launchdarkly/js-sdk-common';

import type { LDInspection } from './LDInspection';

export interface LDOptions {
  /**
   * Whether all context attributes (except the context key) should be marked as private, and
   * not sent to LaunchDarkly in analytics events.
   *
   * By default, this is false.
   */
  allAttributesPrivate?: boolean;

  /**
   * Information about the application where the LaunchDarkly SDK is running.
   */
  application?: {
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
  };

  /**
   * The base uri for the LaunchDarkly server.
   *
   * Most users should use the default value.
   */
  baseUri?: string;

  /**
   * The initial set of flags to use until the remote set is retrieved.
   *
   * If `"localStorage"` is specified, the flags will be saved and retrieved from browser local
   * storage. Alternatively, an {@link LDFlagSet} can be specified which will be used as the initial
   * source of flag values. In the latter case, the flag values will be available via {@link LDClient.variation}
   * immediately after calling `initialize()` (normally they would not be available until the
   * client signals that it is ready).
   *
   * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/features/bootstrapping#javascript).
   */
  bootstrap?: 'localStorage' | LDFlagSet;

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
   * The default value is 100.
   */
  capacity?: number;

  /**
   * Set to true to opt out of sending diagnostics data.
   *
   * Unless `diagnosticOptOut` is set to true, the client will send some diagnostics data to the LaunchDarkly
   * servers in order to assist in the development of future SDK improvements. These diagnostics consist of
   * an initial payload containing some details of SDK in use, the SDK's configuration, and the platform the
   * SDK is being run on, as well as payloads sent periodically with information on irregular occurrences such
   * as dropped events.
   */
  diagnosticOptOut?: boolean;

  /**
   * The interval at which periodic diagnostic data is sent, in seconds.
   *
   * The default is 900 (every 15 minutes) and the minimum value is 6. See {@link diagnosticOptOut}
   * for more information on the diagnostics data being sent.
   */
  diagnosticRecordingInterval?: number;

  /**
   * The base uri for the LaunchDarkly events server.
   *
   * Most users should use the default value.
   */
  eventsUri?: string;

  /**
   * The interval in between flushes of the analytics events queue, in seconds.
   *
   * The default value is 2s.
   */
  flushInterval?: number;

  /**
   * The signed context key for Secure Mode.
   *
   * For more information, see the JavaScript SDK Reference Guide on
   * [Secure mode](https://docs.launchdarkly.com/sdk/features/secure-mode#configuring-secure-mode-in-the-javascript-client-side-sdk).
   */
  hash?: string;

  /**
   * Inspectors can be used for collecting information for monitoring, analytics, and debugging.
   */
  inspectors?: LDInspection[];

  /**
   * An object that will perform logging for the client.
   *
   * If not specified, the default is to use `basicLogger`.
   */
  logger?: LDLogger;

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
   * Whether to send analytics events back to LaunchDarkly. By default, this is true.
   */
  sendEvents?: boolean;

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
   * The base uri for the LaunchDarkly streaming server.
   *
   * Most users should use the default value.
   */
  streamUri?: string;

  /**
   * Whether LaunchDarkly should provide additional information about how flag values were
   * calculated.
   *
   * The additional information will then be available through the client's
   * {@link LDClient.variationDetail} method. Since this increases the size of network requests,
   * such information is not sent unless you set this option to true.
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
}
