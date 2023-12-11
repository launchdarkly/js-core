import {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDLogger,
} from '@launchdarkly/js-sdk-common';

/**
 * The basic interface for the LaunchDarkly client. Platform-specific SDKs may add some methods of their own.
 *
 * @see https://docs.launchdarkly.com/sdk/client-side/javascript
 *
 * @ignore (don't need to show this separately in TypeDoc output; all methods will be shown in LDClient)
 */
export interface LDClient {
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
   * Determines the boolean variation of a feature flag.
   *
   * If the flag variation does not have a boolean value, defaultValue is returned.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   The boolean value.
   */
  boolVariation(key: string, defaultValue: boolean): boolean;

  /**
   * Determines the boolean variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * If the flag variation does not have a boolean value, defaultValue is returned. The reason will
   * indicate an error of the type `WRONG_KIND` in this case.
   *
   * For more information, see the [SDK reference
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#react-native).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *  The result (as an {@link LDEvaluationDetailTyped<boolean>}).
   */
  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean>;

  /**
   * Shuts down the client and releases its resources, after delivering any pending analytics
   * events. After the client is closed, all calls to {@link variation} will return default values,
   * and it will not make any requests to LaunchDarkly.
   */
  close(): void;

  /**
   * Flushes all pending analytics events.
   *
   * Normally, batches of events are delivered in the background at intervals determined by the
   * `flushInterval` property of {@link LDOptions}. Calling `flush()` triggers an immediate delivery.
   *
   * @returns
   *   A Promise which resolves once
   *   flushing is finished. You can inspect the result of the flush for errors.
   */
  flush(): Promise<{ error?: Error; result: boolean }>;

  /**
   * Returns the client's current context.
   *
   * This is the context that was most recently passed to {@link identify}, or, if {@link identify} has never
   * been called, the initial context specified when the client was created.
   */
  getContext(): LDContext;

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
   * @returns
   *   A Promise which resolve once the flag values for the new context are available.
   */
  identify(context: LDContext, hash?: string): Promise<void>;

  /**
   * Determines the json variation of a feature flag.
   *
   * This version may be favored in TypeScript versus `variation` because it returns
   * an `unknown` type instead of `any`. `unknown` will require a cast before usage.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   The json value.
   */
  jsonVariation(key: string, defaultValue: unknown): unknown;

  /**
   * Determines the json variation of a feature flag for a context, along with information about how it
   * was calculated.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * This version may be favored in TypeScript versus `variation` because it returns
   * an `unknown` type instead of `any`. `unknown` will require a cast before usage.
   *
   * For more information, see the [SDK reference
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#react-native).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved with
   *   the result (as an{@link LDEvaluationDetailTyped<unknown>}).
   */
  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown>;

  /**
   * Returns the logger configured as part of LDOptions during construction.
   *
   * For more, read {@link LDOptions.logger}.
   */
  logger: LDLogger;

  /**
   * Determines the numeric variation of a feature flag.
   *
   * If the flag variation does not have a numeric value, defaultValue is returned.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   The numeric value.
   */
  numberVariation(key: string, defaultValue: number): number;

  /**
   * Determines the numeric variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * If the flag variation does not have a numeric value, defaultValue is returned. The reason will
   * indicate an error of the type `WRONG_KIND` in this case.
   *
   * For more information, see the [SDK reference
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#react-native).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   The result (as an {@link LDEvaluationDetailTyped<number>}).
   */
  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number>;

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
   * setting `streaming` in {@link LDOptions} or calling {@link LDClient.setStreaming}.
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
   * Determines the string variation of a feature flag.
   *
   * If the flag variation does not have a string value, defaultValue is returned.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   The string value.
   */
  stringVariation(key: string, defaultValue: string): string;

  /**
   * Determines the string variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * If the flag variation does not have a string value, defaultValue is returned. The reason will
   * indicate an error of the type `WRONG_KIND` in this case.
   *
   * For more information, see the [SDK reference
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#react-native).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   The result (as an {@link LDEvaluationDetailTyped<string>}).
   */
  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string>;

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
}
