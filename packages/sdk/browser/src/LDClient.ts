import {
  LDClient as CommonClient,
  LDContextWithAnonymous,
  LDIdentifyResult,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';

export interface LDStartOptions extends LDWaitForInitializationOptions {
  /**
   * Optional bootstrap data to use for the identify operation. If {@link LDIdentifyOptions.bootstrap} is provided, it will be ignored.
   */
  bootstrap?: unknown;

  /**
   * Optional identify options to use for the identify operation. See {@link LDIdentifyOptions} for more information.
   *
   * @remarks
   * Since the first identify option should never be sheddable, we omit the sheddable option from the interface to avoid confusion.
   */
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

export type LDClient = Omit<
  CommonClient,
  'setConnectionMode' | 'getConnectionMode' | 'getOffline' | 'identify'
> & {
  /**
   * @ignore
   * Implementation Note: We are not supporting dynamically setting the connection mode on the LDClient.
   * Implementation Note: The SDK does not support offline mode. Instead bootstrap data can be used.
   * Implementation Note: The browser SDK has different identify options, so omits the base implementation
   * from the interface.
   */
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
    pristineContext: LDContextWithAnonymous,
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
