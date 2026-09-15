import { ConnectionMode, LDOptions as LDOptionsBase } from '@launchdarkly/js-client-sdk-common';

import type { LDPlugin } from './LDPlugin';

export interface ElectronOptions extends LDOptionsBase {
  /**
   * Set to true to opt in to compressing event payloads if the SDK supports it, since the
   * compression library may not be supported in the underlying SDK framework.  If the compression
   * library is not supported then event payloads will not be compressed even if this option
   * is enabled.
   *
   * Defaults to false.
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
}
