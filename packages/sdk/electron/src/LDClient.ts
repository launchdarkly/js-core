import type { LDClient as NodeLDClient, LDStartOptions } from '@launchdarkly/node-client-sdk';

export type { LDStartOptions };

/**
 * The LaunchDarkly client for the Electron main process.
 *
 * This is a thin composition wrapper around `@launchdarkly/node-client-sdk`'s client and shares
 * its full public surface. `identify()` resolves to an `LDIdentifyResult` and does not throw;
 * `start()` performs the first identify with the initial context supplied to `createClient`.
 */
export interface LDClient extends NodeLDClient {}
