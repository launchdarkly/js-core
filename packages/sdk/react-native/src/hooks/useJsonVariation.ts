import useLDClient from './useLDClient';

export const useJsonVariation = (flagKey: string, defaultValue: unknown) => {
  const ldClient = useLDClient();
  return ldClient?.jsonVariation(flagKey, defaultValue) ?? defaultValue;
};

export const useJsonVariationDetail = (flagKey: string, defaultValue: unknown) => {
  const ldClient = useLDClient();
  return ldClient?.jsonVariationDetail(flagKey, defaultValue) ?? defaultValue;
};

export default useJsonVariation;
