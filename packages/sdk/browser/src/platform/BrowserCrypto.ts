import { Crypto } from '@launchdarkly/js-client-sdk-common';

import BrowserHasher from './BrowserHasher';
import randomUuidV4 from './randomUuidV4';

export default class BrowserCrypto implements Crypto {
  createHash(algorithm: string): BrowserHasher {
    return new BrowserHasher(window.crypto, algorithm);
  }

  randomUUID(): string {
    return randomUuidV4();
  }
}
