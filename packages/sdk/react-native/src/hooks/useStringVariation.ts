import useLDClient from './useLDClient';

export const useStringVariation = (flagKey: string, defaultValue: string) => {
  const ldClient = useLDClient();
  return ldClient?.stringVariation(flagKey, defaultValue) ?? defaultValue;
};

export const useStringVariationDetail = (flagKey: string, defaultValue: string) => {
  const ldClient = useLDClient();
  return ldClient?.stringVariationDetail(flagKey, defaultValue) ?? defaultValue;
};

export default useStringVariation;
