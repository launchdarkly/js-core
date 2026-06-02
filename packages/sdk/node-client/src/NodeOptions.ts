import { ConnectionMode, LDOptions as LDOptionsBase } from '@launchdarkly/js-client-sdk-common';

import type { LDPlugin } from './LDPlugin';

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

/**
 * Configuration options for the Node client-side SDK.
 */
export interface NodeOptions extends LDOptionsBase {
  /**
   * Additional parameters to pass to the Node HTTPS API for secure requests.  These can include any
   * of the TLS-related parameters supported by `https.request()`, such as `ca`, `cert`, and `key`.
   *
   * For more information, see the Node documentation for `https.request()` and `tls.connect()`.
   */
  tlsParams?: LDTLSOptions;

  /**
   * Set to true to opt in to compressing event payloads if the SDK supports it.
   *
   * Defaults to false.
   */
  enableEventCompression?: boolean;

  /**
   * The directory to use for the persistent flag and anonymous-key cache.
   *
   * Defaults to `<cwd>/ldclient-user-cache`.
   */
  localStoragePath?: string;

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
   */
  plugins?: LDPlugin[];

  /**
   * The Secure Mode hash for the configured context.
   *
   * @see https://docs.launchdarkly.com/sdk/features/secure-mode
   */
  hash?: string;
}
