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
   * This function will shed intermediate identify operations by default. For example, if you call identify 3 times in
   * a row, without waiting for the previous one to complete, the middle call to identify may be discarded. To disable
   * this set `sheddable` to `false` in the `identifyOptions` parameter.
   *
   * @param context
   *    The LDContext object.
   * @param identifyOptions
   *    Optional configuration. Please see {@link LDIdentifyOptions}.
   * @returns
   *    A Promise which resolves when the flag values for the specified
   * context are available. It rejects when:
   *
   * 1. The context is unspecified or has no key.
   *
   * 2. The identify timeout is exceeded. In client SDKs this defaults to 5s.
   * You can customize this timeout with {@link LDIdentifyOptions | identifyOptions}.
   *
   * 3. A network error is encountered during initialization.
   *
   * @ignore Implementation Note: Browser implementation has different options.
   */
  identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void>;

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
  identifyResult(
    pristineContext: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult>;
};
