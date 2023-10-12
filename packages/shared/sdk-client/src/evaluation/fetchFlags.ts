import { LDContext, LDEvaluationReason, LDFlagValue, Platform } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { createFetchOptions, createFetchUrl } from './fetchUtils';

export type RawFlag = {
  version: number;
  flagVersion: number;
  value: LDFlagValue;
  variation: number;
  trackEvents: boolean;
  trackReason?: boolean;
  reason?: LDEvaluationReason;
  debugEventsUntilDate?: number;
};

export type RawFlags = {
  [k: string]: RawFlag;
};

const fetchFlags = async (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  { encoding, info, requests }: Platform,
): Promise<RawFlags> => {
  const fetchUrl = createFetchUrl(sdkKey, context, config, encoding!);
  const fetchOptions = createFetchOptions(sdkKey, context, config, info);

  // TODO: add error handling, retry and timeout
  const response = await requests.fetch(fetchUrl, fetchOptions);
  return response.json();
};

export default fetchFlags;
