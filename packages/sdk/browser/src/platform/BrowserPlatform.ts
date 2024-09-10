import {
  Crypto,
  Encoding,
  /* platform */
  LDOptions,
  Requests,
  Storage,
} from '@launchdarkly/js-client-sdk-common';

import BrowserCrypto from './BrowserCrypto';
import BrowserEncoding from './BrowserEncoding';
import BrowserRequests from './BrowserRequests';
import LocalStorage, { isLocalStorageSupported } from './LocalStorage';

export default class BrowserPlatform /* implements platform.Platform */ {
  encoding: Encoding = new BrowserEncoding();
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
