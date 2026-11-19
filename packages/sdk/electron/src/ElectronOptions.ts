import {
  ConnectionMode,
  LDOptions as LDOptionsBase,
  LDStorage,
} from '@launchdarkly/js-client-sdk-common';

import type { LDPlugin } from './LDPlugin';

/**
 * A custom storage implementation for the flag cache. See {@link LDStorage} for the contract.
 */
export type LDElectronStorage = LDStorage;

export interface ElectronOptions extends LDOptionsBase {
  /**
   * Set to `true` to compress analytics event payloads with gzip before they are sent.
   *
   * Defaults to `false`.
   */
  enableEventCompression?: boolean;

  /**
   * Sets the mode to use for connections when the SDK is initialized.
   *
   * @remarks
   * Possible values are offline, streaming, or polling. See {@link ConnectionMode} for more information.
   *
   * Defaults to streaming.
   */
  initialConnectionMode?: ConnectionMode;

  /**
   * A list of plugins to be used with the SDK.
   *
   * Plugin support is currently experimental and subject to change.
   */
  plugins?: LDPlugin[];

  /**
   * When true (the default), registers the Electron IpcMain event handlers so a
   * LaunchDarkly client in renderer processes can communicate with the main process.
   *
   * Defaults to true.
   */
  enableIPC?: boolean;

  /**
   * Will use the client side id as the sdk key instead of the mobile key
   * this is here to support legacy usage of the sdk.
   *
   * @default false
   *
   * @deprecated using client side id as the sdk key is deprecated and will be removed
   * in future versions of this sdk. Please use mobile key instead.
   */
  useClientSideId?: boolean;

  /**
   * An optional namespace to isolate this client's IPC channels
   * from other clients using the same credential in the same process.
   */
  namespace?: string;

  /**
   * A custom storage implementation that replaces the built-in file cache.
   *
   * @remarks
   * By default the SDK persists cached flags to a file in the `ldclient-user-cache` directory
   * under the Electron `userData` directory.
   * Provide an {@link LDElectronStorage} to store that data somewhere else. The SDK catches and logs
   * errors thrown by a custom storage, so they never reach the application.
   */
  storage?: LDElectronStorage;

  /**
   * When `true`, the built-in file cache is encrypted with Electron's `safeStorage` API and is
   * written to its own file. A plain-text cache from an earlier run is deleted and never read.
   *
   * When `safeStorage` reports that encryption is not available, the SDK logs a warning and keeps
   * flags in memory only. It never writes a plain-text cache while this option is `true`. On
   * Linux, the SDK also keeps flags in memory only when `safeStorage` uses the `basic_text`
   * backend, because that backend encrypts with a hardcoded password.
   * `safeStorage` is usable only after the Electron `ready` event on Windows and Linux. The cache
   * waits for that event on every platform.
   *
   * This option has no effect when {@link ElectronOptions.storage} is set.
   *
   * Defaults to `false`.
   */
  encryptStorage?: boolean;
}
