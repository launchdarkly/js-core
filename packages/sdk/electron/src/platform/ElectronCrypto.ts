import { createHash, createHmac, randomUUID } from 'crypto';

import { platform } from '@launchdarkly/js-client-sdk-common';

export default class ElectronCrypto implements platform.Crypto {
  createHash(algorithm: string): platform.Hasher {
    return createHash(algorithm);
  }

  createHmac(algorithm: string, key: string): platform.Hmac {
    return createHmac(algorithm, key);
  }

  randomUUID() {
    return randomUUID();
  }
}
