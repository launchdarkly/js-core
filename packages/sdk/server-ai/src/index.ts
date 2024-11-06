import { LDAIClient } from './api/LDAIClient';
import { LDAIClientImpl } from './LDAIClientImpl';
import { LDClientMin } from './LDClientMin';

/**
 * Initialize a new AI client. This client will be used to perform any AI operations.
 * @param ldClient The base LaunchDarkly client.
 * @returns A new AI client.
 */
export function initAi(ldClient: LDClientMin): LDAIClient {
  return new LDAIClientImpl(ldClient);
}

export * from './api';
