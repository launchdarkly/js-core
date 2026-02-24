import {
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagsState,
  LDFlagsStateOptions,
  LDFlagValue,
} from '@launchdarkly/js-server-sdk-common';

/**
 * The LaunchDarkly server client interface for React.
 *
 * @remarks
 * This is a restrictive version of the LDClient interface.
 * The main reason for this is to ensure we leverage client side
 * rendering appropriately for more dynamic content.
 *
 * @privateRemarks
 * We are basing this off the common server client interface so that we
 * can potentially support edge sdk rendering. The main difference between this
 * interface and the common server interface is that we do not have a context parameter.
 *
 * This is because the context is determined by the context provider and will be different
 * for each request. This is also way that we can "scope" an existing LD server client to
 * serve a specific request session.
 *
 * TODO: I also don't know if we really need the detail variations... not sure if they would
 * really be useful for SSR.
 *
 * @see {@link LDReactServerOptions} for the possible options
 *
 */
export interface LDReactServerClient {
  /**
   * Tests whether the client has completed initialization.
   *
   * If this returns false, it means that the client has not yet successfully connected to
   * LaunchDarkly. It might still be in the process of starting up, or it might be attempting to
   * reconnect after an unsuccessful attempt, or it might have received an unrecoverable error (such
   * as an invalid SDK key) and given up.
   *
   * @returns
   *   True if the client has successfully initialized.
   */
  initialized(): boolean;

  /**
   * Determines the variation of a feature flag for a context.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param callback A Node-style callback to receive the result value. If omitted, you will receive
   *   a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved with
   *   the result value.
   */
  variation(
    key: string,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDFlagValue) => void,
  ): Promise<LDFlagValue>;

  /**
   * Determines the variation of a feature flag for a context, along with information about how it
   * was calculated.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * For more information, see the [SDK reference
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param callback A Node-style callback to receive the result (as an {@link LDEvaluationDetail}).
   *   If omitted, you will receive a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved with
   *   the result (as an{@link LDEvaluationDetail}).
   */
  variationDetail(
    key: string,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail>;

  /**
   * Determines the boolean variation of a feature flag for a context.
   *
   * If the flag variation does not have a boolean value, defaultValue is returned.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   A Promise which will be resolved with the result value.
   */
  boolVariation(key: string, defaultValue: boolean): Promise<boolean>;

  /**
   * Determines the numeric variation of a feature flag for a context.
   *
   * If the flag variation does not have a numeric value, defaultValue is returned.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   A Promise which will be resolved with the result value.
   */
  numberVariation(key: string, defaultValue: number): Promise<number>;

  /**
   * Determines the string variation of a feature flag for a context.
   *
   * If the flag variation does not have a string value, defaultValue is returned.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   A Promise which will be resolved with the result value.
   */
  stringVariation(key: string, defaultValue: string): Promise<string>;

  /**
   * Determines the variation of a feature flag for a context.
   *
   * This version may be favored in TypeScript versus `variation` because it returns
   * an `unknown` type instead of `any`. `unknown` will require a cast before usage.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   A Promise which will be resolved with the result value.
   */
  jsonVariation(key: string, defaultValue: unknown): Promise<unknown>;

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
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   A Promise which will be resolved with the result
   *  (as an {@link LDEvaluationDetailTyped<boolean>}).
   */
  boolVariationDetail(
    key: string,
    defaultValue: boolean,
  ): Promise<LDEvaluationDetailTyped<boolean>>;

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
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   A Promise which will be resolved with the result
   *  (as an {@link LDEvaluationDetailTyped<number>}).
   */
  numberVariationDetail(
    key: string,
    defaultValue: number,
  ): Promise<LDEvaluationDetailTyped<number>>;

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
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @returns
   *   A Promise which will be resolved with the result
   *  (as an {@link LDEvaluationDetailTyped<string>}).
   */
  stringVariationDetail(
    key: string,
    defaultValue: string,
  ): Promise<LDEvaluationDetailTyped<string>>;

  /**
   * Determines the variation of a feature flag for a context, along with information about how it
   * was calculated.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * This version may be favored in TypeScript versus `variation` because it returns
   * an `unknown` type instead of `any`. `unknown` will require a cast before usage.
   *
   * For more information, see the [SDK reference
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param callback A Node-style callback to receive the result (as an {@link LDEvaluationDetail}).
   *   If omitted, you will receive a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved with
   *   the result (as an{@link LDEvaluationDetailTyped<unknown>}).
   */
  jsonVariationDetail(
    key: string,
    defaultValue: unknown,
  ): Promise<LDEvaluationDetailTyped<unknown>>;

  /**
   * Builds an object that encapsulates the state of all feature flags for a given context.
   * This includes the flag values and also metadata that can be used on the front end. This
   * method does not send analytics events back to LaunchDarkly.
   *
   * The most common use case for this method is to bootstrap a set of client-side
   * feature flags from a back-end service. Call the `toJSON()` method of the returned object
   * to convert it to the data structure used by the client-side SDK.
   *
   * @param options
   *   Optional {@link LDFlagsStateOptions} to determine how the state is computed.
   * @param callback
   *   A Node-style callback to receive the result (as an {@link LDFlagsState}). If omitted, you
   *   will receive a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved
   *   with the result as an {@link LDFlagsState}.
   */
  allFlagsState(
    options?: LDFlagsStateOptions,
    callback?: (err: Error | null, res: LDFlagsState | null) => void,
  ): Promise<LDFlagsState>;
}
