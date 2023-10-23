import { LDFlagValue } from '@launchdarkly/js-client-sdk-common';

import useLDClient from './useLDClient';

export const useVariation = (flagKey: string, defaultValue?: any): LDFlagValue => {
  const ldClient = useLDClient();
  return ldClient?.variation(flagKey, defaultValue) ?? defaultValue;
};

export const useVariationDetail = (flagKey: string, defaultValue?: any): LDFlagValue => {
  const ldClient = useLDClient();
  return ldClient?.variationDetail(flagKey, defaultValue) ?? defaultValue;
};

export default useVariation;
