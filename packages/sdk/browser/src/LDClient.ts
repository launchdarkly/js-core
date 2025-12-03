import {
  LDClient as CommonClient,
  LDContext,
  LDIdentifyResult,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';

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
    pristineContext: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult>;

  /**
   * Returns a Promise that tracks the client's initialization state.
   *
   * The Promise will be resolved if the client successfully initializes, or rejected if client
   * initialization takes longer than the set timeout.
   *
   * ```
   *     // using async/await
   *     try {
   *         await client.waitForInitialization(5);
   *         doSomethingWithSuccessfullyInitializedClient();
   *     } catch (err) {
   *         doSomethingForFailedStartup(err);
   *     }
   * ```
   *
   * It is important that you handle the rejection case; otherwise it will become an unhandled Promise
   * rejection, which is a serious error on some platforms. The Promise is not created unless you
   * request it, so if you never call `waitForInitialization()` then you do not have to worry about
   * unhandled rejections.
   *
   * Note that you can also use event listeners ({@link on}) for the same purpose: the event `"initialized"`
   * indicates success, and `"error"` indicates an error.
   *
   * @param timeout
   *  The amount of time, in seconds, to wait for initialization before rejecting the promise.
   *  Using a large timeout is not recommended. If you use a large timeout and await it, then
   *  any network delays will cause your application to wait a long time before
   *  continuing execution.
   *
   *  @default 5 seconds
   *
   * @returns
   *   A Promise that will be resolved if the client initializes successfully, or rejected if it
   *   fails or the specified timeout elapses.
   */
  waitForInitialization(timeout?: number): Promise<void>;
};
