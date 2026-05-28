import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

/**
 * Options for configuring the HTTP proxy.
 */
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

/**
 * Configuration options for the Node client-side SDK.
 */
export interface NodeOptions {
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
   * Optional custom logger. When omitted, the SDK uses its default logger; non-critical
   * messages (e.g. proxy or TLS warnings) are only surfaced when this is set.
   */
  logger?: LDLogger;
}
