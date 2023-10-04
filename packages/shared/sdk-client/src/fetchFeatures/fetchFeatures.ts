import { LDContext, LDEvaluationReason, LDFlagValue, Platform } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { createFetchOptions, createFetchUrl } from './fetchUtils';

export type Feature = {
  version: number;
  flagVersion: number;
  value: LDFlagValue;
  variation: number;
  trackEvents: boolean;
  reason?: LDEvaluationReason;
};

export type Features = {
  [k: string]: Feature;
};

const fetchFeatures = async (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  platform: Platform,
): Promise<Features> => {
  const fetchUrl = createFetchUrl(sdkKey, context, config);
  const fetchOptions: RequestInit = createFetchOptions(sdkKey, context, config, platform.info);
  const response = await fetch(fetchUrl, fetchOptions);
  return response.json();
};

export default fetchFeatures;
