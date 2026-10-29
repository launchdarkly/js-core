import { makeClient } from './ElectronClient';
import type { ElectronIdentifyOptions } from './ElectronIdentifyOptions';
import type { ElectronOptions, LDElectronStorage } from './ElectronOptions';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDContext } from './LDCommon';
import type { LDPlugin } from './LDPlugin';

export * from './LDCommon';

export { resetElectronStorage } from './platform/ElectronStorage';

export type {
  ElectronOptions as LDOptions,
  ElectronIdentifyOptions as LDIdentifyOptions,
  LDClient,
  LDElectronStorage,
  LDPlugin,
  LDStartOptions,
};

/**
 * Creates the LaunchDarkly client in the Electron main process. The client is not ready until
 * {@link LDClient.start} is called.
 *
 * Call this from the main process only. Renderer processes use `createRendererClient` from
 * `@launchdarkly/electron-client-sdk/renderer` together with the preload bridge from
 * `@launchdarkly/electron-client-sdk/bridge`.
 *
 * @param credential The LaunchDarkly mobile key, or the client-side ID when
 *   `options.useClientSideId` is `true`.
 * @param initialContext The initial context used for the first identify when `start()` is called.
 * @param options Optional configuration. See {@link LDOptions}.
 * @returns The client instance. Call `client.start()` before you evaluate flags. Call `identify()`
 *   for later context changes. The returned client's `identify()` resolves to an
 *   {@link LDIdentifyResult} and does not throw.
 * @throws When `options.enableIPC` is `true` (the default) and another open client already uses
 *   the same credential and `namespace`.
 * @throws When `options.hash` is set and `options.useClientSideId` is `false`.
 */
export function createClient(
  credential: string,
  initialContext: LDContext,
  options: ElectronOptions = {},
): LDClient {
  return makeClient(credential, initialContext, options);
}
