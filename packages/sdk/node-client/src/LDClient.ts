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
   * containing the result of the identify operation.
   *
   * @param context The context to identify @see {@link LDContext}
   * @param identifyOptions Optional configuration @see {@link LDIdentifyOptions}.
   * @returns an identify result @see {@link LDIdentifyResult}
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
   * @see {@link ConnectionMode}
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
