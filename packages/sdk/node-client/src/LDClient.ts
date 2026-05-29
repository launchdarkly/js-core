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
   *
   * @param context The context to identify.
   * @param identifyOptions Optional configuration including {@link LDIdentifyOptions.bootstrap}.
   * @returns A promise which resolves to an object containing the result of the identify operation.
   */
  identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<LDIdentifyResult>;

  /**
   * Starts the client by performing the first identify with the initial context. Must be
   * called after {@link createClient}. The returned promise resolves when the first
   * identify completes (or times out, or fails).
   *
   * @param options Optional configuration. See {@link LDStartOptions}.
   */
  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult>;

  /**
   * Sets the data source connection mode.
   *
   * Pass `'offline'` to stop the streaming or polling connection and disable analytics event
   * delivery. Pass `'streaming'` or `'polling'` to (re)establish the connection using the
   * current context. The returned promise resolves once the mode change has been applied.
   */
  setConnectionMode(mode: ConnectionMode): Promise<void>;

  /**
   * Returns the current data source connection mode.
   */
  getConnectionMode(): ConnectionMode;

  /**
   * Returns true if the client is in offline mode.
   */
  isOffline(): boolean;
}
