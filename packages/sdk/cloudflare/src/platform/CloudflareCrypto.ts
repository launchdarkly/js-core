/* eslint-disable */
import { platform } from '@launchdarkly/js-server-sdk-common';

/**
 * TODO: implement this class
 */
export default class CloudflareCrypto implements platform.Crypto {
  createHash(algorithm: string): platform.Hasher {
    throw new Error('Method not implemented.');
  }
  createHmac(algorithm: string, key: string): platform.Hmac {
    throw new Error('Method not implemented.');
  }
  randomUUID(): string {
    return crypto.randomUUID();
  }
}
