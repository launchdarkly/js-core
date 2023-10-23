import { useContext } from 'react';

import { LDFlagValue } from '@launchdarkly/js-client-sdk-common';

import { context, ReactSdkContext } from '../provider/reactSdkContext';

const useVariation = (flagKey: string): LDFlagValue => {
  const { ldClient } = useContext<ReactSdkContext>(context);
  return ldClient?.variation(flagKey);
};

export default useVariation;
