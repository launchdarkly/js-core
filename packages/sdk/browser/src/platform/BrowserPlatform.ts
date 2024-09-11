import {
  Crypto,
  Encoding,
  Info,
  LDOptions,
  Platform,
  Requests,
  Storage,
} from '@launchdarkly/js-client-sdk-common';

import BrowserCrypto from './BrowserCrypto';
import BrowserEncoding from './BrowserEncoding';
import BrowserInfo from './BrowserInfo';
import BrowserRequests from './BrowserRequests';
import LocalStorage, { isLocalStorageSupported } from './LocalStorage';

export default class BrowserPlatform implements Platform {
  encoding: Encoding = new BrowserEncoding();
  info: Info = new BrowserInfo();
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
