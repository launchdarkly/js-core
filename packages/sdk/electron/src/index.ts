import type { LDContext } from '@launchdarkly/js-client-sdk-common';

import { makeClient } from './ElectronClient';
import type { ElectronIdentifyOptions } from './ElectronIdentifyOptions';
import type { ElectronOptions, LDProxyOptions, LDTLSOptions } from './ElectronOptions';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';

export * from '@launchdarkly/js-client-sdk-common';

export type {
  ElectronIdentifyOptions,
  ElectronOptions as LDOptions,
  LDClient,
  LDPlugin,
  LDProxyOptions,
  LDStartOptions,
  LDTLSOptions,
};

/**
 * Creates the LaunchDarkly client in the Electron main process. The client is not ready until
 * {@link LDClient.start} is called.
 *
 * @param credential The LaunchDarkly mobile key, or client-side ID when options.useClientSideId is true.
 * @param initialContext The initial context used for the first identify when start() is called.
 * @param options Optional configuration.
 * @returns The client instance. Call client.start() before using variations or identify() for context changes.
 * The returned client's identify() resolves to an {@link LDIdentifyResult} and does not throw.
 */
export function createClient(
  credential: string,
  initialContext: LDContext,
  options: ElectronOptions = {},
): LDClient {
  return makeClient(credential, initialContext, options);
}
