import { useTypedVariation, useTypedVariationDetail } from './useTypedVariation';

export const useVariation = (key: string, defaultValue?: boolean) =>
  useTypedVariation<any>(key, defaultValue);

export const useVariationDetail = (key: string, defaultValue?: boolean) =>
  useTypedVariationDetail<any>(key, defaultValue);
