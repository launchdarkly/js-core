import type {
  ConnectionMode,
  LDClient as LDClientBase,
  LDContext,
  LDIdentifyOptions,
  LDIdentifyResult,
  LDStartOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

export type { LDStartOptions };

export interface LDClient extends Omit<LDClientBase, 'identify'> {
  /**
   * Identifies a context to LaunchDarkly and returns a promise which resolves to an object
   * containing the result of the identify operation. Optionally accepts bootstrap data so that
   * the identify operation completes without waiting for the network.
   * Must not be called before {@link LDClient.start} has been called.
   *
   * @param context The context to identify.
   * @param identifyOptions Optional configuration including {@link LDIdentifyOptions.bootstrap}.
   * @returns A promise which resolves to an object containing the result of the identify operation.
   */
  identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<LDIdentifyResult>;

  /**
   * Starts the client by performing the first identify with the initial context passed to
   * createClient. The client is not ready until this is called. Returns a promise that
   * resolves when the first identify completes (or times out or fails).
   *
   * @param options Optional configuration. See {@link LDStartOptions}.
   */
  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult>;

  setConnectionMode(mode: ConnectionMode): Promise<void>;

  getConnectionMode(): ConnectionMode;

  isOffline(): boolean;
}
