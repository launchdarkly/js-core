import { makeClient } from './ElectronClient';
import type { ElectronOptions } from './ElectronOptions';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDContext } from './LDCommon';
import type { LDPlugin } from './LDPlugin';

export * from './LDCommon';

/** @internal */
export { resetElectronStorage } from './platform/ElectronStorage';

export type { ElectronOptions as LDOptions, LDClient, LDPlugin, LDStartOptions };

/**
 * Creates the LaunchDarkly client in the Electron main process. The client is not ready until
 * {@link LDClient.start} is called.
 *
 * Can be called at any point in the app's startup, including before Electron's `ready` event.
 * Polling, analytics, and diagnostic requests use Electron's `net` module, which is only usable
 * once `ready` has fired; those requests transparently wait for it internally. The streaming
 * connection (the default) has no such requirement.
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
