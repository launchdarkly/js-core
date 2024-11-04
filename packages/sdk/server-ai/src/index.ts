import { LDClient } from '@launchdarkly/node-server-sdk';

import { LDAIClient } from './api/LDAIClient';
import { LDAIClientImpl } from './LDAIClientImpl';

/**
 * Initialize a new AI client. This client will be used to perform any AI operations.
 * @param ldClient The base LaunchDarkly client.
 * @returns A new AI client.
 */
export function initAi(ldClient: LDClient): LDAIClient {
  return new LDAIClientImpl(ldClient);
}

export * from './api';
