import { LDContext, LDEvaluationReason, LDFlagValue, Platform } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { createFetchOptions, createFetchUrl } from './fetchUtils';

export type Flag = {
  version: number;
  flagVersion: number;
  value: LDFlagValue;
  variation: number;
  trackEvents: boolean;
  reason?: LDEvaluationReason;
};

export type Flags = {
  [k: string]: Flag;
};

const fetchFlags = async (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  { encoding, info, requests }: Platform,
): Promise<Flags> => {
  const fetchUrl = createFetchUrl(sdkKey, context, config, encoding!);
  const fetchOptions = createFetchOptions(sdkKey, context, config, info);
  const response = await requests.fetch(fetchUrl, fetchOptions);
  return response.json();
};

export default fetchFlags;
