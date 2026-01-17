import useLDClient from '../useLDClient';
import { LDEvaluationDetailTyped } from './LDEvaluationDetail';

/**
 * Determines the strongly typed variation of a feature flag.
 *
 * @param key The unique key of the feature flag.
 * @param defaultValue The default value of the flag, to be used if the value is not available
 *   from LaunchDarkly.
 * @returns
 *   The strongly typed value.
 */
export const useTypedVariation = <T extends boolean | number | string | unknown>(
  key: string,
  defaultValue: T,
): T => {
  const ldClient = useLDClient();

  switch (typeof defaultValue) {
    case 'boolean':
      return ldClient.boolVariation(key, defaultValue as boolean) as T;
    case 'number':
      return ldClient.numberVariation(key, defaultValue as number) as T;
    case 'string':
      return ldClient.stringVariation(key, defaultValue as string) as T;
    case 'undefined':
    case 'object':
      return ldClient.jsonVariation(key, defaultValue) as T;
    default:
      return ldClient.variation(key, defaultValue);
  }
};

/**
 * Determines the strongly typed variation of a feature flag for a context, along with information about
 * how it was calculated.
 *
 * The `reason` property of the result will also be included in analytics events, if you are
 * capturing detailed event data for this flag.
 *
 * If the flag variation does not have the specified type, defaultValue is returned. The reason will
 * indicate an error of the type `WRONG_KIND` in this case.
 *
 * For more information, see the [SDK reference
 * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#react-native).
 *
 * @param key The unique key of the feature flag.
 * @param defaultValue The default value of the flag, to be used if the value is not available
 *   from LaunchDarkly.
 * @returns
 *  The result (as an {@link LDEvaluationDetailTyped<T>}).
 */
export const useTypedVariationDetail = <T extends boolean | number | string | unknown>(
  key: string,
  defaultValue: T,
): LDEvaluationDetailTyped<T> => {
  const ldClient = useLDClient();

  switch (typeof defaultValue) {
    case 'boolean': {
      const detail = ldClient.boolVariationDetail(key, defaultValue as boolean);

      return {
        ...detail,
        reason: detail.reason ?? null,
      } as LDEvaluationDetailTyped<T>;
    }
    case 'number': {
      const detail = ldClient.numberVariationDetail(key, defaultValue as number);

      return {
        ...detail,
        reason: detail.reason ?? null,
      } as LDEvaluationDetailTyped<T>;
    }
    case 'string': {
      const detail = ldClient.stringVariationDetail(key, defaultValue as string);

      return {
        ...detail,
        reason: detail.reason ?? null,
      } as LDEvaluationDetailTyped<T>;
    }
    case 'undefined':
    case 'object': {
      const detail = ldClient.jsonVariationDetail(key, defaultValue);

      return {
        ...detail,
        reason: detail.reason ?? null,
      } as LDEvaluationDetailTyped<T>;
    }
    default: {
      const detail = ldClient.variationDetail(key, defaultValue);

      return {
        ...detail,
        reason: detail.reason ?? null,
      } as LDEvaluationDetailTyped<T>;
    }
  }
};
