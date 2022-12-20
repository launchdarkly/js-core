/**
 * Interface implemented by platform provided hasher.
 *
 * The hash implementation must support 'sha256' and 'sha1'.
 *
 * The has implementation must support digesting to 'hex' or 'base64'.
 */
export interface Hasher {
  update(data: string): Hasher;
  digest(encoding: string): string
}

/**
 * Interface implemented by platform provided hmac.
 *
 * The hash implementation must support 'sha256'.
 *
 * The has implementation must support digesting to 'hex'.
 */
export interface Hmac extends Hasher {
  update(data: string): Hasher;
  digest(encoding: string): string;
}

/**
 * Interface provided by the platform for doing cryptographic operations.
 */
export interface Crypto {
  createHash(algorithm: string): Hasher;
  createHmac(algorithm: string, key: string): Hmac;
}
