import { useTypedVariation, useTypedVariationDetail } from './useTypedVariation';

export const useVariation = (key: string, defaultValue?: boolean) =>
  useTypedVariation<any>(key, defaultValue);

/**
 * Note that this will only work if you have set `withReasons` to true in {@link LDOptions}.
 * Otherwise, the `reason` property of the result will be null.
 *
 * @param key
 * @param defaultValue
 */
export const useVariationDetail = (key: string, defaultValue?: boolean) =>
  useTypedVariationDetail<any>(key, defaultValue);
