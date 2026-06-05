import type { LDFlagValue } from '@launchdarkly/js-client-sdk-common';
import type { LDContext, LDReactClient, LDReactClientOptions } from '@launchdarkly/react-sdk';
import { createClient, createLDReactProviderWithClient } from '@launchdarkly/react-sdk';

import TestData from '../TestData';

const TEST_CLIENT_SIDE_ID = 'client-testing-plugin';

export interface CreateTestClientResult {
  client: LDReactClient;
  testData: TestData;
}

export interface CreateTestClientProviderResult {
  Provider: ReturnType<typeof createLDReactProviderWithClient>;
  client: LDReactClient;
  testData: TestData;
}

/**
 * Creates a `@launchdarkly/react-sdk` client wired with the `TestData` plugin
 * and the settings required for offline test usage.
 *
 * @param context the LDContext to identify the test client as
 * @param initialFlags optional seed map of flag keys to values
 * @param options optional react-sdk options
 *
 * @returns an object containing the test client and test data
 */
export function createTestClient(
  context: LDContext,
  initialFlags?: { [key: string]: LDFlagValue },
  options?: Partial<LDReactClientOptions>,
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

/**
 * Creates a `@launchdarkly/react-sdk` client and a pre-wired Provider component,
 * ready to wrap components under test.
 *
 * @param context the LDContext to identify the test client as
 * @param initialFlags optional seed map of flag keys to values
 * @param options optional react-sdk options
 *
 * @returns an object containing the Provider component, client, and testData
 */
export function createTestClientProvider(
  context: LDContext,
  initialFlags?: { [key: string]: LDFlagValue },
  options?: Partial<LDReactClientOptions>,
): CreateTestClientProviderResult {
  const { client, testData } = createTestClient(context, initialFlags, options);
  const Provider = createLDReactProviderWithClient(client);
  return { Provider, client, testData };
}
