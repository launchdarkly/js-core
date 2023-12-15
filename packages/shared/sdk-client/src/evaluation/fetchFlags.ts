import { LDContext, LDEvaluationReason, LDFlagValue, Platform } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { createFetchOptions, createFetchUrl } from './fetchUtils';

export interface Flag {
  version: number;
  flagVersion: number;
  value: LDFlagValue;
  variation: number;
  trackEvents: boolean;
  trackReason?: boolean;
  reason?: LDEvaluationReason;
  debugEventsUntilDate?: number;
}

export interface PatchFlag extends Flag {
  key: string;
}

export type DeleteFlag = Pick<PatchFlag, 'key' | 'version'>;

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

  // TODO: add error handling, retry and timeout
  const response = await requests.fetch(fetchUrl, fetchOptions);
  return response.json();
};

export default fetchFlags;
