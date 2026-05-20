import {
  LDClient as CommonClient,
  LDContext,
  LDIdentifyOptions,
} from '@launchdarkly/js-client-sdk-common';

/**
 * React Native LDClient type. Overrides `identify()` to return `Promise<void>` and throw on
 * error/timeout to maintain backward compatibility with existing React Native consumers.
 */
export type LDClient = Omit<CommonClient, 'identify'> & {
  /**
   * Identifies a context to LaunchDarkly.
   *
   * Unlike the server-side SDKs, the client-side JavaScript SDKs maintain a current context state,
   * which is set when you call `identify()`.
   *
   * Changing the current context also causes all feature flag values to be reloaded. Until that has
   * finished, calls to {@link variation} will still return flag values for the previous context. You can
   * await the Promise to determine when the new flag values are available.
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
   */
  identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void>;
};
