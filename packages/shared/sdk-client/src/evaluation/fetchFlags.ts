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

/**
 * Dom api usage: fetch.
 */
const fetchFlags = async (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  platform: Platform,
): Promise<Flags> => {
  const fetchUrl = createFetchUrl(sdkKey, context, config, platform.encoding!);
  const fetchOptions: RequestInit = createFetchOptions(sdkKey, context, config, platform.info);
  const response = await fetch(fetchUrl, fetchOptions);
  return response.json();
};

export default fetchFlags;
