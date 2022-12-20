/* eslint-disable class-methods-use-this */
import { platform } from '@launchdarkly/js-server-sdk-common';
import FastlyHash from './FastlyHash';

export default class FastlyCrypto implements platform.Crypto {
  createHash(algorithm: string): platform.Hasher {
    return new FastlyHash(algorithm);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createHmac(algorithm: string, key: string): platform.Hmac {
    return new FastlyHash(algorithm);
  }
}
