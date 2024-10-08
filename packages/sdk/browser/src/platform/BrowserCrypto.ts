import { Crypto } from '@launchdarkly/js-client-sdk-common';

import { getCrypto } from '../BrowserApi';
import BrowserHasher from './BrowserHasher';
import randomUuidV4 from './randomUuidV4';

export default class BrowserCrypto implements Crypto {
  createHash(algorithm: string): BrowserHasher {
    return new BrowserHasher(getCrypto(), algorithm);
  }

  randomUUID(): string {
    return randomUuidV4();
  }
}
