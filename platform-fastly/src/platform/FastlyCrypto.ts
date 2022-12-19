/* eslint-disable class-methods-use-this */
import { platform } from '@launchdarkly/js-server-sdk-common';

import * as crypto from 'crypto';

export default class FastlyCrypto implements platform.Crypto {
  createHash(algorithm: string): platform.Hasher {
    return crypto.createHash(algorithm);
  }

  createHmac(algorithm: string, key: string): platform.Hmac {
    return crypto.createHmac(algorithm, key);
  }
}
