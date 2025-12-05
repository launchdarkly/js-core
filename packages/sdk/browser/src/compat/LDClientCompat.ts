import { LDContext, LDFlagSet } from '@launchdarkly/js-client-sdk-common';

import { LDClient as LDCLientBrowser } from '../LDClient';

/**
 * Compatibility interface. This interface extends the base LDCLient interface with functions
 * that improve backwards compatibility.
 *
 * If starting a new project please import the root package instead of `/compat`.
 *
 * In the `launchdarkly-js-client-sdk@3.x` package a number of functions had the return typings
 * incorrect. Any function which optionally returned a promise based on a callback had incorrect
 * typings. Those have been corrected in this implementation.
 */
export interface LDClient extends Omit<
  LDCLientBrowser,
  'close' | 'flush' | 'identify' | 'identifyResult'
> {
  /**
   * Identifies a context to LaunchDarkly.
   *
   * Unlike the server-side SDKs, the client-side JavaScript SDKs maintain a current context state,
   * which is set at initialization time. You only need to call `identify()` if the context has changed
   * since then.
   *
   * Changing the current context also causes all feature flag values to be reloaded. Until that has
   * finished, calls to {@link variation} will still return flag values for the previous context. You can
   * use a callback or a Promise to determine when the new flag values are available.
   *
   * @param context
   *   The context properties. Must contain at least the `key` property.
   * @param hash
   *   The signed context key if you are using [Secure Mode](https://docs.launchdarkly.com/sdk/features/secure-mode#configuring-secure-mode-in-the-javascript-client-side-sdk).
   * @param onDone
   *   A function which will be called as soon as the flag values for the new context are available,
   *   with two parameters: an error value (if any), and an {@link LDFlagSet} containing the new values
   *   (which can also be obtained by calling {@link variation}). If the callback is omitted, you will
   *   receive a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which resolve once the flag
   *   values for the new context are available, providing an {@link LDFlagSet} containing the new values
   *   (which can also be obtained by calling {@link variation}).
   */
  identify(
    context: LDContext,
    hash?: string,
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void,
  ): Promise<LDFlagSet> | undefined;

  /**
   * Returns a Promise that tracks the client's initialization state.
   *
   * The Promise will be resolved if the client successfully initializes, or rejected if client
   * initialization has irrevocably failed (for instance, if it detects that the SDK key is invalid).
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
   * indicates success, and `"failed"` indicates failure.
   *
   * @param timeout
   *  The amount of time, in seconds, to wait for initialization before rejecting the promise.
   *  Using a large timeout is not recommended. If you use a large timeout and await it, then
   *  any network delays will cause your application to wait a long time before
   *  continuing execution.
   *
   *  If no timeout is specified, then the returned promise will only be resolved when the client
   *  successfully initializes or initialization fails.
   *
   * @returns
   *   A Promise that will be resolved if the client initializes successfully, or rejected if it
   *   fails or the specified timeout elapses.
   */
  waitForInitialization(timeout?: number): Promise<void>;

  /**
   * Returns a Promise that tracks the client's initialization state.
   *
   * The returned Promise will be resolved once the client has either successfully initialized
   * or failed to initialize (e.g. due to an invalid environment key or a server error). It will
   * never be rejected.
   *
   * ```
   *     // using async/await
   *     await client.waitUntilReady();
   *     doSomethingWithClient();
   * ```
   *
   * If you want to distinguish between these success and failure conditions, use
   * {@link waitForInitialization} instead.
   *
   * If you prefer to use event listeners ({@link on}) rather than Promises, you can listen on the
   * client for a `"ready"` event, which will be fired in either case.
   *
   * @returns
   *   A Promise that will be resolved once the client is no longer trying to initialize.
   * @deprecated Please use {@link waitForInitialization} instead. This method will always
   * cause a warning to be logged because it is implemented via waitForInitialization.
   */
  waitUntilReady(): Promise<void>;

  /**
   * Shuts down the client and releases its resources, after delivering any pending analytics
   * events.
   *
   * @param onDone
   *   A function which will be called when the operation completes. If omitted, you
   *   will receive a Promise instead.
   *
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which resolves once
   *   closing is finished. It will never be rejected.
   */
  close(onDone?: () => void): Promise<void> | undefined;

  /**
   * Flushes all pending analytics events.
   *
   * Normally, batches of events are delivered in the background at intervals determined by the
   * `flushInterval` property of {@link LDOptions}. Calling `flush()` triggers an immediate delivery.
   *
   * @param onDone
   *   A function which will be called when the flush completes. If omitted, you
   *   will receive a Promise instead.
   *
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which resolves once
   *   flushing is finished. Note that the Promise will be rejected if the HTTP request
   *   fails, so be sure to attach a rejection handler to it.
   */
  flush(onDone?: () => void): Promise<void> | undefined;
}
