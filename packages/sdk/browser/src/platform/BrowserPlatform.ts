import {
  Crypto,
  /* platform */
  LDOptions,
  Requests,
  Storage,
} from '@launchdarkly/js-client-sdk-common';

import BrowserCrypto from './BrowserCrypto';
import BrowserRequests from './BrowserRequests';
import LocalStorage, { isLocalStorageSupported } from './LocalStorage';

export default class BrowserPlatform /* implements platform.Platform */ {
  // encoding?: Encoding;
  // info: Info;
  // fileSystem?: Filesystem;
  crypto: Crypto = new BrowserCrypto();
  requests: Requests = new BrowserRequests();
  storage?: Storage;

  constructor(options: LDOptions) {
    if (isLocalStorageSupported()) {
      this.storage = new LocalStorage(options.logger);
    }
  }
}
