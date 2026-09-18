import {
  Crypto,
  Encoding,
  Info,
  LDEventSourceFactory,
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
  requests: Requests;
  storage?: Storage;

  constructor(
    logger: LDLogger,
    options: BrowserOptions,
    storage?: Storage,
    eventSourceFactory?: LDEventSourceFactory,
  ) {
    this.storage = storage ?? (isLocalStorageSupported() ? new LocalStorage(logger) : undefined);
    this.requests = new BrowserRequests(eventSourceFactory);
    this.info = new BrowserInfo(options);
  }
}
