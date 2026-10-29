/**
 * The Node `Buffer` type when `@types/node` declares it as a global `var`, and `never` otherwise.
 *
 * This package is also used on edge runtimes, where consumers do not have `@types/node`.
 * A direct `Buffer` reference would not resolve for those consumers.
 *
 * The type comes from the `Buffer.isBuffer` type guard, which every `@types/node` version declares
 * as `obj is Buffer`. Inferring it from the constructor would pick up the last `new` overload, which
 * returns `Buffer<ArrayBuffer>` in some versions. That narrower type rejects a plain `Buffer`.
 *
 * Known limit: `typeof globalThis` only sees `var` declarations. `@types/node` versions older than
 * 16.3.3 declare `Buffer` as a `const` or a `class`, so they also resolve to `never`.
 */
type GlobalBuffer = typeof globalThis extends {
  Buffer: { isBuffer(obj: any): obj is infer T };
}
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
