/* eslint-disable class-methods-use-this */
import { createHash, createHmac, randomUUID } from 'crypto';

import { platform } from '@launchdarkly/js-server-sdk-common';

export default class NodeCrypto implements platform.Crypto {
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
