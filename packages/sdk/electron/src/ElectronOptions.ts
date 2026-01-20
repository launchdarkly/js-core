import { ConnectionMode, LDOptions as LDOptionsBase } from '@launchdarkly/js-client-sdk-common';

import type { LDPlugin } from './LDPlugin';

export interface LDProxyOptions {
  /**
   * Allows you to specify a host for an optional HTTP proxy.
   */
  host?: string;

  /**
   * Allows you to specify a port for an optional HTTP proxy.
   *
   * Both the host and port must be specified to enable proxy support.
   */
  port?: number;

  /**
   * When using an HTTP proxy, specifies whether it is accessed via `http` or `https`.
   */
  scheme?: string;

  /**
   * Allows you to specify basic authentication parameters for an optional HTTP proxy.
   * Usually of the form `username:password`.
   */
  auth?: string;
}

/**
 * Additional parameters to pass to the Node HTTPS API for secure requests.  These can include any
 * of the TLS-related parameters supported by `https.request()`, such as `ca`, `cert`, and `key`.
 *
 * For more information, see the Node documentation for `https.request()` and `tls.connect()`.
 */
export interface LDTLSOptions {
  ca?: string | string[] | Buffer | Buffer[];
  cert?: string | string[] | Buffer | Buffer[];
  checkServerIdentity?: (servername: string, cert: any) => Error | undefined;
  ciphers?: string;
  pfx?: string | string[] | Buffer | Buffer[] | object[];
  key?: string | string[] | Buffer | Buffer[] | object[];
  passphrase?: string;
  rejectUnauthorized?: boolean;
  secureProtocol?: string;
  servername?: string;
}

export interface ElectronOptions extends LDOptionsBase {
  /**
   * Allows you to specify configuration for an optional HTTP proxy.
   */
  proxyOptions?: LDProxyOptions;

  /**
   * Additional parameters to pass to the Node HTTPS API for secure requests.  These can include any
   * of the TLS-related parameters supported by `https.request()`, such as `ca`, `cert`, and `key`.
   *
   * For more information, see the Node documentation for `https.request()` and `tls.connect()`.
   */
  tlsParams?: LDTLSOptions;

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
   * Whether to register the Electron IpcMain event handlers to support a LaunchDarkly
   * client in the renderer processes.
   *
   * Defaults to true.
   */
  registerInMain?: boolean;
}
