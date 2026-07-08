import type { Crypto, Hasher, Hmac } from '@launchdarkly/js-server-sdk-common';

import CryptoJSHasher from './cryptoJSHasher';
import CryptoJSHmac from './cryptoJSHmac';
import { SupportedHashAlgorithm } from './types';

/**
 * Uses crypto-js to implement hashing and HMAC.
 *
 * Fastly Compute exposes a native WebCrypto (crypto.subtle), but its digest/sign
 * operations are asynchronous, and the SDK's Crypto contract requires a synchronous
 * digest() (used on the synchronous flag-bucketing path). crypto-js provides the
 * synchronous hashing the contract needs.
 * https://cryptojs.gitbook.io/docs/
 */
export default class EdgeCrypto implements Crypto {
  createHash(algorithm: SupportedHashAlgorithm): Hasher {
    return new CryptoJSHasher(algorithm);
  }

  createHmac(algorithm: SupportedHashAlgorithm, key: string): Hmac {
    return new CryptoJSHmac(algorithm, key);
  }

  randomUUID(): string {
    return crypto.randomUUID();
  }
}
