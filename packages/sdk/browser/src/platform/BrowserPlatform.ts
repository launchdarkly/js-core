import {
  Crypto,
  /* platform */
  LDOptions,
  Storage,
} from '@launchdarkly/js-client-sdk-common';

import BrowserCrypto from './BrowserCrypto';
import LocalStorage, { isLocalStorageSupported } from './LocalStorage';

export default class BrowserPlatform /* implements platform.Platform */ {
  // encoding?: Encoding;
  // info: Info;
  // fileSystem?: Filesystem;
  crypto: Crypto = new BrowserCrypto();
  // requests: Requests;
  storage?: Storage;

  constructor(options: LDOptions) {
    if (isLocalStorageSupported()) {
      this.storage = new LocalStorage(options.logger);
    }
  }
}
