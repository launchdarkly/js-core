import {
  ConnectionMode,
  LDOptions as LDOptionsBase,
  LDStorage,
} from '@launchdarkly/js-client-sdk-common';

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
   * Directory for the built-in file-backed persistent flag and anonymous-key cache.
   *
   * Defaults to `<process.cwd()>/ldclient-user-cache`. Ignored when {@link storage}
   * is also set - a warning will be logged in that case.
   */
  localStoragePath?: string;

  /**
   * Custom storage implementation for the persistent flag and anonymous-key cache.
   *
   * When provided, the SDK uses this implementation instead of the built-in
   * file-backed storage. Use {@link localStoragePath} if you only need to change
   * the directory used by the default file-backed storage.
   *
   * Setting both `storage` and `localStoragePath` is not supported. When both are
   * present, `storage` takes precedence and `localStoragePath` is ignored.
   */
  storage?: LDStorage;

  /**
   * The Secure Mode hash for the configured context.
   *
   * This value can be overridden on a per-identify basis via {@link NodeIdentifyOptions.hash}.
   *
   * @see https://docs.launchdarkly.com/sdk/features/secure-mode
   */
  hash?: string;

  /**
   * If `true`, the credential passed to {@link createClient} is treated as a
   * **mobile key** rather than a client-side ID. The SDK then uses the mobile
   * event paths (`/mobile`, `/mobile/events/diagnostic`), the mobile FDv1
   * data source endpoints (`/msdk/evalx/...`, `/meval/...`), and the
   * `'mobileKey'` credential type. The credential is sent as an
   * `Authorization` header rather than embedded in URLs.
   *
   * Defaults to `false` (client-side ID mode).
   *
   * Note: secure mode ({@link NodeOptions.hash}) is not supported in mobile
   * key mode. Setting both `useMobileKey: true` and `hash` will cause
   * {@link createClient} to throw.
   */
  useMobileKey?: boolean;
}
