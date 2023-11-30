import { useTypedVariation, useTypedVariationDetail } from './useTypedVariation';

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
export const useBoolVariation = (key: string, defaultValue: boolean) =>
  useTypedVariation<boolean>(key, defaultValue);

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
export const useBoolVariationDetail = (key: string, defaultValue: boolean) =>
  useTypedVariationDetail<boolean>(key, defaultValue);

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
export const useNumberVariation = (key: string, defaultValue: number) =>
  useTypedVariation<number>(key, defaultValue);

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
export const useNumberVariationDetail = (key: string, defaultValue: number) =>
  useTypedVariationDetail<number>(key, defaultValue);

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
export const useStringVariation = (key: string, defaultValue: string) =>
  useTypedVariation<string>(key, defaultValue);

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
export const useStringVariationDetail = (key: string, defaultValue: string) =>
  useTypedVariationDetail<string>(key, defaultValue);

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
export const useJsonVariation = (key: string, defaultValue: unknown) =>
  useTypedVariation<unknown>(key, defaultValue);

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
export const useJsonVariationDetail = (key: string, defaultValue: unknown) =>
  useTypedVariationDetail<unknown>(key, defaultValue);
