import type {
  ConnectionMode,
  LDClient as LDClientBase,
  LDContext,
  LDIdentifyResult,
  LDStartOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

import type { ElectronIdentifyOptions } from './ElectronIdentifyOptions';

export type { LDStartOptions };

export interface LDClient extends Omit<LDClientBase, 'identify'> {
  /**
   * Identifies a context to LaunchDarkly and returns a promise which resolves to an object
   * containing the result of the identify operation. Optionally accepts bootstrap data so that
   * the identify operation completes without waiting for the network, and a secure mode `hash`.
   * Must not be called before {@link LDClient.start} has been called.
   *
   * @param context The context to identify.
   * @param identifyOptions Optional configuration. See {@link ElectronIdentifyOptions}.
   * @returns A promise which resolves to an object containing the result of the identify operation.
   */
  identify(
    context: LDContext,
    identifyOptions?: ElectronIdentifyOptions,
  ): Promise<LDIdentifyResult>;

  /**
   * Starts the client by performing the first identify with the initial context passed to
   * createClient. The client is not ready until this is called. Returns a promise that
   * resolves when the first identify completes (or times out or fails).
   *
   * @param options Optional configuration. See {@link LDStartOptions}.
   */
  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult>;

  /**
   * Sets the connection mode. With the `dataSystem` option, an explicit call sets an override.
   * The override stays until the client closes. The SDK then ignores network changes.
   *
   * @param mode The connection mode to use.
   */
  setConnectionMode(mode: ConnectionMode): Promise<void>;

  getConnectionMode(): ConnectionMode;

  isOffline(): boolean;

  /**
   * Tells the SDK whether the network is available. The SDK does not detect network changes on
   * its own. Call this from the main process when the application learns of a change.
   *
   * With the default data source, `false` pauses the connection and `true` resumes it in the
   * current connection mode. With the `dataSystem` option, the value is forwarded to the data
   * system. The data system switches to `offline` and back only when automatic network switching
   * is enabled in `dataSystem.automaticModeSwitching`. Otherwise the call is ignored. Desktop
   * turns automatic network switching off by default, so with a default `dataSystem`
   * configuration this call has no effect. An explicit call to `setConnectionMode` under
   * `dataSystem` sets an override, and the SDK then ignores network changes.
   *
   * This method exists on the main-process client only.
   *
   * @param available `true` when the network is available, `false` when it is not.
   */
  setNetworkAvailability(available: boolean): void;
}
