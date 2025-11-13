import type { Crypto, Hasher, Hmac } from '@launchdarkly/js-server-sdk-common';

import CryptoJSHasher from './cryptoJSHasher';
import CryptoJSHmac from './cryptoJSHmac';
import { SupportedHashAlgorithm } from './types';

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
