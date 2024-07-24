import { LDContext, Platform } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { LDEvaluationResultsMap } from '../types';
import { createFetchOptions, createFetchUrl } from './fetchUtils';

const fetchFlags = async (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  { encoding, info, requests }: Platform,
): Promise<LDEvaluationResultsMap> => {
  const fetchUrl = createFetchUrl(sdkKey, context, config, encoding!);
  const fetchOptions = createFetchOptions(sdkKey, context, config, info);

  // TODO: add error handling, retry and timeout
  const response = await requests.fetch(fetchUrl, fetchOptions);
  return response.json();
};

export default fetchFlags;
