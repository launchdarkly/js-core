import {
  Crypto,
  Encoding,
  Info,
  LDLogger,
  Platform,
  Requests,
  Storage,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserOptions } from '../options';
import BrowserCrypto from './BrowserCrypto';
import BrowserEncoding from './BrowserEncoding';
import BrowserInfo from './BrowserInfo';
import BrowserRequests from './BrowserRequests';
import LocalStorage, { isLocalStorageSupported } from './LocalStorage';

export default class BrowserPlatform implements Platform {
  encoding: Encoding = new BrowserEncoding();
  info: Info;
  // fileSystem?: Filesystem;
  crypto: Crypto = new BrowserCrypto();
  requests: Requests = new BrowserRequests();
  storage?: Storage;

  constructor(logger: LDLogger, options: BrowserOptions) {
    if (isLocalStorageSupported()) {
      this.storage = new LocalStorage(logger);
    }
    this.info = new BrowserInfo(options);
  }
}
