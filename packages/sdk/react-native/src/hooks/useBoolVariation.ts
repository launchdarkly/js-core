import useLDClient from './useLDClient';
import useLDContextInfo from './useLDContextInfo';

export const useBoolVariation = (flagKey: string, defaultValue: boolean) => {
  const ldClient = useLDClient();
  const { identifyStatus } = useLDContextInfo();

  // only invoke variation functions if identify is successful
  if (identifyStatus === 'success') {
    return ldClient.boolVariation(flagKey, defaultValue);
  }

  return defaultValue;
};

export const useBoolVariationDetail = (flagKey: string, defaultValue: boolean) => {
  const ldClient = useLDClient();
  const def = {
    value: defaultValue,
    variationIndex: null,
    reason: null,
  };
  return ldClient?.boolVariationDetail(flagKey, defaultValue) ?? def;
};

export default useBoolVariation;
