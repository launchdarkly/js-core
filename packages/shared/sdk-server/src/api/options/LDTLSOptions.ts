/**
 * The Node `Buffer` type when the Node type definitions are present, and `never` otherwise.
 *
 * This package is also used on edge runtimes, where consumers do not have `@types/node`.
 * A direct `Buffer` reference would not resolve for those consumers.
 */
type GlobalBuffer = typeof globalThis extends { Buffer: new (...args: never[]) => infer T }
  ? T
  : never;

/**
 * Additional parameters to pass to the Node HTTPS API for secure requests.  These can include any
 * of the TLS-related parameters supported by `https.request()`, such as `ca`, `cert`, and `key`.
 *
 * For more information, see the Node documentation for `https.request()` and `tls.connect()`.
 */
export interface LDTLSOptions {
  ca?: string | string[] | GlobalBuffer | GlobalBuffer[];
  cert?: string | string[] | GlobalBuffer | GlobalBuffer[];
  checkServerIdentity?: (servername: string, cert: any) => Error | undefined;
  ciphers?: string;
  pfx?: string | string[] | GlobalBuffer | GlobalBuffer[] | object[];
  key?: string | string[] | GlobalBuffer | GlobalBuffer[] | object[];
  passphrase?: string;
  rejectUnauthorized?: boolean;
  secureProtocol?: string;
  servername?: string;
}
