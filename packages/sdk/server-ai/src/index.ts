/**
 * This is the API reference for the LaunchDarkly AI SDK for Server-Side JavaScript.
 *
 * In typical usage, you will call {@link initAi} once at startup time to obtain an instance of
 * {@link LDAIClient}, which provides access to all of the SDK's functionality.
 *
 * @packageDocumentation
 */
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

export { LDLogger } from '@launchdarkly/js-server-sdk-common';

export * from './api';
