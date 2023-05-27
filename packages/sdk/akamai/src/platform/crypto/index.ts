// @ts-ignore. // this crypto is provided by Akamai's platform at runtime
import { crypto as AkamaiCrypto } from 'crypto';
import type { Crypto, Hasher, Hmac } from '@launchdarkly/js-server-sdk-common';
import CryptoJSHasher from './cryptoJSHasher';
import CryptoJSHmac from './cryptoJSHmac';
import { SupportedHashAlgorithm } from './types';

/**
 * Uses crypto-js as substitute to node:crypto because the latter
 * is not yet supported in Akamai runtimes.
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
    let array = new Uint32Array(1);
    AkamaiCrypto.getRandomValues(array);
    return array.join();
  }
}
