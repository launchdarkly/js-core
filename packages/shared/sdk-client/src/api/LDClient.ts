import { LDContext, LDFlagSet, LDFlagValue, LDLogger } from '@launchdarkly/js-sdk-common';

import { Hook } from './integrations/Hooks';
import { LDEvaluationDetail, LDEvaluationDetailTyped } from './LDEvaluationDetail';
import { LDIdentifyOptions } from './LDIdentifyOptions';
import { LDIdentifyResult } from './LDIdentifyResult';

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
   *   {@link variation}, so any flag that cannot be evaluated will be undefined.
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
   * Determines the boolean variation of a feature flag, along with information about
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
   * events.
   */
  close(): Promise<void>;

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
   * been called, this will be undefined.
   */
  getContext(): LDContext | undefined;

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
   * If used with the `sheddable` option set to true, then the identify operation will be sheddable. This means that if
   * multiple identify operations are done, without waiting for the previous one to complete, then intermediate
   * operations may be discarded.
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
   * Determines the json variation of a feature flag, along with information about how it
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
   *  The result (as an {@link LDEvaluationDetailTyped<unknown>}).
   */
  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown>;

  /**
   * The logger configured as part of LDOptions during construction.
   *
   * @remarks
   * For more information, read {@link LDOptions.logger} and {@link LDLogger}.
   *
   * @returns The configured {@link LDLogger}.
   */
  readonly logger: LDLogger;

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
   * @remarks
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
   * Removes an event listener. See {@link on} for the available event types.
   *
   * @param key
   *   The name of the event for which to stop listening.
   * @param callback
   *   The function to deregister.
   */
  off(key: string, callback: (...args: any[]) => void): void;

  /**
   * Registers an event listener.
   *
   * @remarks
   * You can subscribe to one of the supported {@link EventName}:
   *
   * - `"change"`: The client has received new feature flag data. This can happen either
   *   because you have switched contexts with {@link identify}, or because the client has a
   *   stream connection and has received a live change to a flag value (see below).
   *   The callback parameters are the context and an array of flag keys that have changed.
   *
   * - `"error"`: General event for any kind of error condition during client operation.
   *   The callback parameters are the context and an Error object. Errors are also output by
   *   the {@link logger} at the error level.
   *
   * - `"dataSourceStatus"`: Event indicating that there has been a change in the status of the
   *   data source. This will include the state of the data source as well any error information.
   *
   * @param key
   *   The name of the event for which to listen.
   * @param callback
   *   The function to execute when the event fires. The callback may or may not
   *   receive parameters, depending on the type of event.
   */
  on(key: string, callback: (...args: any[]) => void): void;

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
   * @remarks
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
   * Track events for experiments.
   *
   * @param key
   *   The name of the event, which may correspond to a goal in an experiment.
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
   * We recommend using strongly typed variation methods which perform
   * type checks and handle type errors.
   *
   * @remarks
   * Determines the variation of a feature flag.
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
   * We recommend using strongly typed variation detail methods which perform
   * type checks and handle type errors.
   *
   * @remarks
   * Determines the variation of a feature flag for a context, along with information about how it was
   * calculated.
   *
   * Note that this will only work if you have set `withReasons` to true in {@link LDOptions}.
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
   * Add a hook to the client. In order to register a hook before the client
   * starts, please use the `hooks` property of {@link LDOptions}.
   *
   * Hooks provide entrypoints which allow for observation of SDK functions.
   *
   * @param Hook The hook to add.
   */
  addHook(hook: Hook): void;
}

/**
 * Interface that extends the LDClient interface to include the identifyResult method.
 *
 * This is an independent interface for backwards compatibility. Adding this to the LDClient interface would require
 * a breaking change.
 */
export interface LDClientIdentifyResult {
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
   */
  identifyResult(
    context: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult>;
}
