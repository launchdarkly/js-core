import {
  LDClient as CommonClient,
  LDStartOptions as CommonLDStartOptions,
  FDv2ConnectionMode,
  LDContext,
  LDIdentifyResult,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';

/**
 * Browser-specific start options that extend the common start options
 * with browser-specific identify options (see {@link LDIdentifyOptions}).
 */
export interface LDStartOptions extends CommonLDStartOptions {
  identifyOptions?: Omit<LDIdentifyOptions, 'sheddable'>;
}

/**
 *
 * The LaunchDarkly SDK client object.
 *
 * Applications should configure the client at page load time and reuse the same instance.
 *
 * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/client-side/javascript).
 */

export type LDClient = Omit<CommonClient, 'getConnectionMode' | 'getOffline' | 'identify'> & {
  /**
   * @ignore
   * Implementation Note: The SDK does not support offline mode. Instead bootstrap data can be used.
   * Implementation Note: The browser SDK has different identify options, so omits the base implementation
   * from the interface.
   */
  /**
   * @internal
   *
   * This feature is experimental and should NOT be considered ready for
   * production use. It may change or be removed without notice and is not
   * subject to backwards compatibility guarantees.
   *
   * Sets the connection mode for the SDK's data system.
   *
   * When set, this mode is used exclusively, overriding all automatic mode
   * selection (including {@link setStreaming}). The {@link setStreaming} state
   * is not modified -- {@link setConnectionMode} acts as a higher-priority
   * override.
   *
   * Pass `undefined` (or call with no arguments) to clear the override and
   * return to automatic mode selection.
   *
   * This method requires the FDv2 data system (`dataSystem` option). If
   * FDv2 is not enabled, the call logs a warning and has no effect.
   *
   * @param mode The connection mode to use, or `undefined` to clear the override.
   */
  setConnectionMode(mode?: FDv2ConnectionMode): void;

  /**
   * Specifies whether or not to open a streaming connection to LaunchDarkly for live flag updates.
   *
   * If this is true, the client will always attempt to maintain a streaming connection; if false,
   * it never will. If you leave the value undefined (the default), the client will open a streaming
   * connection if you subscribe to `"change"` or `"change:flag-key"` events (see {@link LDClient.on}).
   *
   * This can also be set as the `streaming` property of {@link LDOptions}.
   */
  setStreaming(streaming?: boolean): void;

  /**
   * Identifies a context to LaunchDarkly and returns a promise which resolves to an object containing the result of
   * the identify operation.
   *
   * Unlike the server-side SDKs, the client-side JavaScript SDKs maintain a current context state,
   * which is set when you call `identify()`.
   *
   * Changing the current context also causes all feature flag values to be reloaded. Until that has
   * finished, calls to {@link variation} will still return flag values for the previous context. You can
   * await the Promise to determine when the new flag values are available.
   *
   * If used with the `sheddable` option set to true, then the identify operation will be sheddable. This means that if
   * multiple identify operations are done, without waiting for the previous one to complete, then intermediate
   * operations may be discarded.
   *
   * @param context
   *    The LDContext object.
   * @param identifyOptions
   *    Optional configuration. Please see {@link LDIdentifyOptions}.
   * @returns
   *    A promise which resolves to an object containing the result of the identify operation.
   *    The promise returned from this method will not be rejected.
   *
   * @ignore Implementation Note: Browser implementation has different options.
   */
  identify(
    pristineContext: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult>;

  /**
   * Returns a Promise that tracks the client's initialization state.
   *
   * The Promise will be resolved to a {@link LDWaitForInitializationResult} object containing the
   * status of the waitForInitialization operation.
   *
   * @example
   * This example shows use of async/await syntax for specifying handlers:
   * ```
   *     const result = await client.waitForInitialization({ timeout: 5 });
   *
   *     if (result.status === 'complete') {
   *       doSomethingWithSuccessfullyInitializedClient();
   *     } else if (result.status === 'failed') {
   *       doSomethingForFailedStartup(result.error);
   *     } else if (result.status === 'timeout') {
   *       doSomethingForTimedOutStartup();
   *     }
   * ```
   *
   * @remarks
   * You can also use event listeners ({@link on}) for the same purpose: the event `"initialized"`
   * indicates success, and `"error"` indicates an error.
   *
   * @param options
   *  Optional configuration. Please see {@link LDWaitForInitializationOptions}.
   *
   * @returns
   *   A Promise that will be resolved to a {@link LDWaitForInitializationResult} object containing the
   *   status of the waitForInitialization operation.
   */
  waitForInitialization(
    options?: LDWaitForInitializationOptions,
  ): Promise<LDWaitForInitializationResult>;

  /**
   * Starts the client and returns a promise that resolves to the initialization result.
   *
   * The promise will resolve to a {@link LDWaitForInitializationResult} object containing the
   * status of the waitForInitialization operation.
   *
   * @param options Optional configuration. Please see {@link LDStartOptions}.
   */
  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult>;
};
