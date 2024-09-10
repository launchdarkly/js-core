import { Crypto, Encoding, Info, LDOptions, Storage } from '@launchdarkly/js-client-sdk-common';

import BrowserCrypto from './BrowserCrypto';
import BrowserEncoding from './BrowserEncoding';
import BrowserInfo from './BrowserInfo';
import LocalStorage, { isLocalStorageSupported } from './LocalStorage';

export default class BrowserPlatform /* implements platform.Platform */ {
  encoding?: Encoding = new BrowserEncoding();
  info: Info = new BrowserInfo();
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
