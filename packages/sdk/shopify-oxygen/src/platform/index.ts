import type { Info } from '@launchdarkly/js-server-sdk-common';
import { platform } from '@launchdarkly/js-server-sdk-common';

import OxygenCrypto from './OxygenCrypto';
import OxygenRequests from './OxygenRequests';
import { OxygenCacheOptions } from '../utils/validateOptions';

export default class OxygenPlatform implements platform.Platform {
  info: Info;

  crypto: platform.Crypto = new OxygenCrypto();

  requests: platform.Requests;

  constructor(info: Info, cacheOptions: OxygenCacheOptions = {}) {
    this.info = info;
    this.requests = new OxygenRequests(cacheOptions);
  }
}
