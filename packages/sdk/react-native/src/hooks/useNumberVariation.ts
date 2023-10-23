import useLDClient from './useLDClient';

export const useNumberVariation = (flagKey: string, defaultValue: number) => {
  const ldClient = useLDClient();
  return ldClient?.numberVariation(flagKey, defaultValue) ?? defaultValue;
};

export const useNumberVariationDetail = (flagKey: string, defaultValue: number) => {
  const ldClient = useLDClient();
  return ldClient?.numberVariationDetail(flagKey, defaultValue) ?? defaultValue;
};

export default useNumberVariation;
