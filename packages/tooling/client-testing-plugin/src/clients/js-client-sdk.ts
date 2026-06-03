import type { LDFlagValue } from '@launchdarkly/js-client-sdk-common';
import type { LDClient, LDContext, LDOptions } from '@launchdarkly/js-client-sdk';
import { createClient } from '@launchdarkly/js-client-sdk';

import TestData from '../TestData';

const TEST_CLIENT_SIDE_ID = 'client-testing-plugin';

export interface CreateTestClientResult {
  client: LDClient;
  testData: TestData;
}

/**
 * Creates a `@launchdarkly/js-client-sdk` client wired with the `TestData`
 * plugin and the settings required for offline test usage.
 *
 * @param context the LDContext to identify the test client as
 * @param initialFlags optional seed map of flag keys to values
 * @param options optional LDOptions
 *
 * @returns an object containing the test client and test data
 */
export function createTestClient(
  context: LDContext,
  initialFlags?: { [key: string]: LDFlagValue },
  options?: Partial<LDOptions>,
): CreateTestClientResult {
  const testData = new TestData(initialFlags);
  const userPlugins = options?.plugins ?? [];
  const client = createClient(TEST_CLIENT_SIDE_ID, context, {
    ...options,
    plugins: [...userPlugins, testData],
    sendEvents: false,
    streaming: false,
  });
  return { client, testData };
}
