import useLDClient from './useLDClient';

export const useBoolVariation = (flagKey: string, defaultValue: boolean) => {
  const ldClient = useLDClient();
  return ldClient?.boolVariation(flagKey, defaultValue) ?? defaultValue;
};

export const useBoolVariationDetail = (flagKey: string, defaultValue: boolean) => {
  const ldClient = useLDClient();
  return ldClient?.boolVariationDetail(flagKey, defaultValue) ?? defaultValue;
};

export default useBoolVariation;
