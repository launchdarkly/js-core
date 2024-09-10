/**
 * Interface implemented by platform provided hasher.
 *
 * The hash implementation must support 'sha256' and 'sha1'.
 *
 * The has implementation must support digesting to 'hex' or 'base64'.
 */
export interface Hasher {
  update(data: string): Hasher;
  /**
   * Note: All server SDKs MUST implement synchronous digest.
   *
   * Server SDKs have high performance requirements for bucketing users.
   */
  digest?(encoding: string): string;

  /**
   * Note: Client-side SDKs MUST implement either synchronous or asynchronous digest.
   *
   * Client SDKs do not have high throughput hashing operations.
   */
  asyncDigest?(encoding: string): Promise<string>;
}

/**
 * Interface implemented by platform provided hmac.
 *
 * The hash implementation must support 'sha256'.
 *
 * The has implementation must support digesting to 'hex'.
 */
export interface Hmac {
  update(data: string): Hasher;
  digest(encoding: string): string;
}

/**
 * Interface provided by the platform for doing cryptographic operations.
 */
export interface Crypto {
  createHash(algorithm: string): Hasher;
  /**
   * Note: Server SDKs MUST implement createHmac.
   */
  createHmac?(algorithm: string, key: string): Hmac;
  randomUUID(): string;
}
