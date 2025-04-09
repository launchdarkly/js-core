import { useTypedVariation, useTypedVariationDetail } from './useTypedVariation';

export const useBoolVariation = (key: string, defaultValue: boolean) =>
  useTypedVariation<boolean>(key, defaultValue);

export const useStringVariation = (key: string, defaultValue: string) =>
  useTypedVariation<string>(key, defaultValue);

export const useNumberVariation = (key: string, defaultValue: number) =>
  useTypedVariation<number>(key, defaultValue);

export const useJsonVariation = (key: string, defaultValue?: undefined) =>
  useTypedVariation<undefined>(key, defaultValue);

export const useVariation = (key: string, defaultValue?: boolean) =>
  useTypedVariation<any>(key, defaultValue);

/**
 * Note that this will only work if you have set `withReasons` to true in {@link LDOptions}.
 * Otherwise, the `reason` property of the result will be null.
 *
 * @param key
 * @param defaultValue
 */
export const useBoolVariationDetail = (key: string, defaultValue: boolean) =>
  useTypedVariationDetail<boolean>(key, defaultValue);

export const useStringVariationDetail = (key: string, defaultValue: string) =>
  useTypedVariationDetail<string>(key, defaultValue);

export const useNumberVariationDetail = (key: string, defaultValue: number) =>
  useTypedVariationDetail<number>(key, defaultValue);

export const useJsonVariationDetail = (key: string, defaultValue?: undefined) =>
  useTypedVariationDetail<undefined>(key, defaultValue);

export const useVariationDetail = (key: string, defaultValue?: boolean) =>
  useTypedVariationDetail<any>(key, defaultValue);
