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
   * This option applies only to the default data source. When the `dataSystem` option is set, the
   * SDK ignores it and logs a warning. Use `dataSystem.automaticModeSwitching` instead.
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
   * When `true`, the client registers `ipcMain` handlers so a renderer client created with
   * `createRendererClient` can use this client through the preload bridge.
   *
   * Set to `false` when only the main process uses the SDK. No IPC channel is registered and
   * renderer clients cannot connect.
   *
   * Defaults to `true`.
   */
  enableIPC?: boolean;

  /**
   * Selects the client-side ID as the credential. When `true`, the credential passed to
   * `createClient` is a client-side ID instead of a mobile key, and the SDK uses the client-side
   * endpoints.
   *
   * Secure mode ({@link ElectronOptions.hash}) works only with the client-side ID. Setting `hash`
   * while this option is `false` makes `createClient` throw.
   *
   * Defaults to `false` (mobile key).
   */
  useClientSideId?: boolean;

  /**
   * The secure mode hash for the initial context.
   *
   * Secure mode works only when {@link ElectronOptions.useClientSideId} is `true`. `createClient`
   * throws when this option is set with a mobile key. A `hash` passed in the identify options
   * replaces this value for that identify call and the requests that follow it.
   *
   * @see https://docs.launchdarkly.com/sdk/features/secure-mode
   */
  hash?: string;

  /**
   * An optional namespace that isolates this client's IPC channels from other clients that use
   * the same credential in the same main process.
   *
   * Two IPC-enabled clients (`enableIPC` is `true`) that share a credential must each set a unique
   * namespace. Otherwise the second `createClient` call throws before it builds the client.
   * Renderer clients must pass the same namespace to `createRendererClient`.
   */
  namespace?: string;

  /**
   * A custom storage implementation that replaces the built-in file cache.
   *
   * @remarks
   * By default the SDK persists cached flags to a file in the Electron `userData` directory.
   * Provide an {@link LDElectronStorage} to store that data somewhere else. The SDK catches and logs
   * errors thrown by a custom storage, so they never reach the application.
   */
  storage?: LDElectronStorage;

  /**
   * When `true`, the built-in file cache is encrypted with Electron's `safeStorage` API and is
   * written to its own file. A plain-text cache from an earlier run is deleted and never read.
   *
   * When `safeStorage` reports that encryption is not available, the SDK logs a warning and keeps
   * flags in memory only. It never writes a plain-text cache while this option is `true`.
   * `safeStorage` is usable only after the Electron `ready` event, so the cache waits for it.
   *
   * This option has no effect when {@link ElectronOptions.storage} is set.
   *
   * Defaults to `false`.
   */
  encryptStorage?: boolean;
}
