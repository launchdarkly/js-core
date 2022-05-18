/* eslint-disable class-methods-use-this */
import { platform } from '@launchdarkly/js-server-sdk-common';
import { Hasher, Hmac } from '@launchdarkly/js-server-sdk-common/dist/platform/Crypto';

import * as crypto from 'crypto';

export default class NodeCrypto implements platform.Crypto {
  createHash(algorithm: string): Hasher {
    return crypto.createHash(algorithm);
  }

  createHmac(algorithm: string, key: string): Hmac {
    return crypto.createHmac(algorithm, key);
  }
}
