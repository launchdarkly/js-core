import type { LDOptions as NodeOptions } from '@launchdarkly/node-client-sdk';

import type { LDPlugin } from './LDPlugin';

/**
 * Configuration options for the Electron main-process LaunchDarkly client.
 *
 * Inherits the full option surface of `@launchdarkly/node-client-sdk` (including `tlsParams`,
 * `enableEventCompression`, `initialConnectionMode`, `hash`, `storage`, and `localStoragePath`),
 * except `useMobileKey` (derived from {@link ElectronOptions.useClientSideId}) and `plugins`
 * (re-declared below with the Electron plugin type).
 */
export interface ElectronOptions extends Omit<NodeOptions, 'useMobileKey' | 'plugins'> {
  /**
   * A list of plugins to be used with the SDK.
   *
   * Plugin support is currently experimental and subject to change.
   */
  plugins?: LDPlugin[];

  /**
   * When true, registers the Electron IpcMain event handlers so a LaunchDarkly client in
   * renderer processes can communicate with the main process.
   *
   * @default true
   */
  enableIPC?: boolean;

  /**
   * Will use the client-side ID as the SDK key instead of the mobile key. This is here to
   * support legacy usage of the SDK.
   *
   * @default false
   *
   * @deprecated Using the client-side ID as the SDK key is deprecated and will be removed in a
   * future version of this SDK. Please use a mobile key instead.
   */
  useClientSideId?: boolean;

  /**
   * An optional namespace to isolate this client's IPC channels from other clients using the
   * same credential in the same process.
   */
  namespace?: string;
}
