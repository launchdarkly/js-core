import type { Info } from '@launchdarkly/js-server-sdk-common';
import { platform } from '@launchdarkly/js-server-sdk-common';

import OxygenCrypto from './OxygenCrypto';
import OxygenRequests, { OxygenCacheOptions } from './OxygenRequests';

// TODO: move this out to the config utils file
const defaultCacheOptions: OxygenCacheOptions = {
  ttlSeconds: 30,
  cacheName: 'launchdarkly-cache',
  cacheEnabled: true,
}

export default class OxygenPlatform implements platform.Platform {
  info: Info;

  crypto: platform.Crypto = new OxygenCrypto();

  requests: platform.Requests;

  constructor(info: Info, cacheOptions: OxygenCacheOptions = {}) {
    const mergedCacheOptions = { ...defaultCacheOptions, ...cacheOptions };

    this.info = info;
    this.requests = new OxygenRequests(mergedCacheOptions);
  }
}
