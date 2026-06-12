import type {
  ConnectionMode,
  LDClient as LDClientBase,
  LDContext,
  LDIdentifyResult,
  LDStartOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

import type { NodeIdentifyOptions } from './NodeIdentifyOptions';

export type { LDStartOptions };

export interface LDClient extends Omit<LDClientBase, 'identify'> {
  /**
   * Identifies a context to LaunchDarkly and returns a promise which resolves to an object
   * containing the result of the identify operation.
   *
   * Unlike the server-side SDKs, the client-side Node.js SDK maintains a current context
   * state, which is set when you call `identify()`.
   *
   * Changing the current context also causes all feature flag values to be reloaded. Until
   * that has finished, calls to variation methods will still return flag values for the
   * previous context. You can await the Promise to determine when the new flag values are
   * available.
   *
   * Use {@link start} to set the initial context at startup.
   *
   * @param context The context to identify. @see {@link LDContext}
   * @param identifyOptions Optional configuration. @see {@link LDIdentifyOptions}.
   * @returns A promise which resolves to an object containing the result of the identify operation.
   */
  identify(context: LDContext, identifyOptions?: NodeIdentifyOptions): Promise<LDIdentifyResult>;

  /**
   * Starts the client and returns a promise that resolves to the initialization result.
   *
   * The promise will resolve to a {@link LDWaitForInitializationResult} object containing the
   * status of the waitForInitialization operation.
   *
   * @param options Optional configuration. See {@link LDStartOptions}.
   */
  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult>;

  /**
   * Sets the data source connection mode.
   *
   * @remarks
   * Switches between 'offline', 'streaming', and 'polling' at runtime without restarting
   * the client. Use 'offline' to pause all LaunchDarkly network activity.
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
