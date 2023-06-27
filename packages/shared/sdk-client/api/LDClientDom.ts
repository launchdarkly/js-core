import { LDContext, LDEvaluationDetail, LDFlagSet, LDFlagValue } from '@launchdarkly/js-sdk-common';

/**
 * The basic interface for the LaunchDarkly client. Platform-specific SDKs may add some methods of their own.
 *
 * @see https://docs.launchdarkly.com/sdk/client-side/javascript
 *
 * @ignore (don't need to show this separately in TypeDoc output; all methods will be shown in LDClient)
 */
export interface LDClientDom {
  /**
   * Returns a Promise that tracks the client's initialization state.
   *
   * The returned Promise will be resolved once the client has either successfully initialized
   * or failed to initialize (e.g. due to an invalid environment key or a server error). It will
   * never be rejected.
   *
   * ```
   *     // using a Promise then() handler
   *     client.waitUntilReady().then(() => {
   *         doSomethingWithClient();
   *     });
   *
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
   */
  waitUntilReady(): Promise<void>;

  /**
   * Returns a Promise that tracks the client's initialization state.
   *
   * The Promise will be resolved if the client successfully initializes, or rejected if client
   * initialization has irrevocably failed (for instance, if it detects that the SDK key is invalid).
   *
   * ```
   *     // using Promise then() and catch() handlers
   *     client.waitForInitialization().then(() => {
   *         doSomethingWithSuccessfullyInitializedClient();
   *     }).catch(err => {
   *         doSomethingForFailedStartup(err);
   *     });
   *
   *     // using async/await
   *     try {
   *         await client.waitForInitialization();
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
   * @returns
   *   A Promise that will be resolved if the client initializes successfully, or rejected if it
   *   fails.
   */
  waitForInitialization(): Promise<void>;

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
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void
  ): Promise<LDFlagSet>;

  /**
   * Returns the client's current context.
   *
   * This is the context that was most recently passed to {@link identify}, or, if {@link identify} has never
   * been called, the initial context specified when the client was created.
   */
  getContext(): LDContext;

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
  flush(onDone?: () => void): Promise<void>;

  /**
   * Determines the variation of a feature flag for the current context.
   *
   * In the client-side JavaScript SDKs, this is always a fast synchronous operation because all of
   * the feature flag values for the current context have already been loaded into memory.
   *
   * @param key
   *   The unique key of the feature flag.
   * @param defaultValue
   *   The default value of the flag, to be used if the value is not available from LaunchDarkly.
   * @returns
   *   The flag's value.
   */
  variation(key: string, defaultValue?: LDFlagValue): LDFlagValue;

  /**
   * Determines the variation of a feature flag for a context, along with information about how it was
   * calculated.
   *
   * Note that this will only work if you have set `evaluationExplanations` to true in {@link LDOptions}.
   * Otherwise, the `reason` property of the result will be null.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * For more information, see the [SDK reference guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#javascript).
   *
   * @param key
   *   The unique key of the feature flag.
   * @param defaultValue
   *   The default value of the flag, to be used if the value is not available from LaunchDarkly.
   *
   * @returns
   *   An {@link LDEvaluationDetail} object containing the value and explanation.
   */
  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail;

  /**
   * Specifies whether or not to open a streaming connection to LaunchDarkly for live flag updates.
   *
   * If this is true, the client will always attempt to maintain a streaming connection; if false,
   * it never will. If you leave the value undefined (the default), the client will open a streaming
   * connection if you subscribe to `"change"` or `"change:flag-key"` events (see {@link LDClientDom.on}).
   *
   * This can also be set as the `streaming` property of {@link LDOptions}.
   */
  setStreaming(value?: boolean): void;

  /**
   * Registers an event listener.
   *
   * The following event names (keys) are used by the client:
   *
   * - `"ready"`: The client has finished starting up. This event will be sent regardless
   *   of whether it successfully connected to LaunchDarkly, or encountered an error
   *   and had to give up; to distinguish between these cases, see below.
   * - `"initialized"`: The client successfully started up and has valid feature flag
   *   data. This will always be accompanied by `"ready"`.
   * - `"failed"`: The client encountered an error that prevented it from connecting to
   *   LaunchDarkly, such as an invalid environment ID. All flag evaluations will
   *   therefore receive default values. This will always be accompanied by `"ready"`.
   * - `"error"`: General event for any kind of error condition during client operation.
   *   The callback parameter is an Error object. If you do not listen for "error"
   *   events, then the errors will be logged with `console.log()`.
   * - `"change"`: The client has received new feature flag data. This can happen either
   *   because you have switched contexts with {@link identify}, or because the client has a
   *   stream connection and has received a live change to a flag value (see below).
   *   The callback parameter is an {@link LDFlagChangeset}.
   * - `"change:FLAG-KEY"`: The client has received a new value for a specific flag
   *   whose key is `FLAG-KEY`. The callback receives two parameters: the current (new)
   *   flag value, and the previous value. This is always accompanied by a general
   *   `"change"` event as described above; you can listen for either or both.
   *
   * The `"change"` and `"change:FLAG-KEY"` events have special behavior: by default, the
   * client will open a streaming connection to receive live changes if and only if
   * you are listening for one of these events. This behavior can be overridden by
   * setting `streaming` in {@link LDOptions} or calling {@link LDClientDom.setStreaming}.
   *
   * @param key
   *   The name of the event for which to listen.
   * @param callback
   *   The function to execute when the event fires. The callback may or may not
   *   receive parameters, depending on the type of event.
   * @param context
   *   The `this` context to use for the callback.
   */
  on(key: string, callback: (...args: any[]) => void, context?: any): void;

  /**
   * Deregisters an event listener. See {@link on} for the available event types.
   *
   * @param key
   *   The name of the event for which to stop listening.
   * @param callback
   *   The function to deregister.
   * @param context
   *   The `this` context for the callback, if one was specified for {@link on}.
   */
  off(key: string, callback: (...args: any[]) => void, context?: any): void;

  /**
   * Track page events to use in goals or A/B tests.
   *
   * LaunchDarkly automatically tracks pageviews and clicks that are specified in the
   * Goals section of their dashboard. This can be used to track custom goals or other
   * events that do not currently have goals.
   *
   * @param key
   *   The name of the event, which may correspond to a goal in A/B tests.
   * @param data
   *   Additional information to associate with the event.
   * @param metricValue
   *   An optional numeric value that can be used by the LaunchDarkly experimentation
   *   feature in numeric custom metrics. Can be omitted if this event is used by only
   *   non-numeric metrics. This field will also be returned as part of the custom event
   *   for Data Export.
   */
  track(key: string, data?: any, metricValue?: number): void;

  /**
   * Returns a map of all available flags to the current context's values.
   *
   * @returns
   *   An object in which each key is a feature flag key and each value is the flag value.
   *   Note that there is no way to specify a default value for each flag as there is with
   *   {@link variation}, so any flag that cannot be evaluated will have a null value.
   */
  allFlags(): LDFlagSet;

  /**
   * Shuts down the client and releases its resources, after delivering any pending analytics
   * events. After the client is closed, all calls to {@link variation} will return default values,
   * and it will not make any requests to LaunchDarkly.
   *
   * @param onDone
   *   A function which will be called when the operation completes. If omitted, you
   *   will receive a Promise instead.
   *
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which resolves once
   *   closing is finished. It will never be rejected.
   */
  close(onDone?: () => void): Promise<void>;
}
