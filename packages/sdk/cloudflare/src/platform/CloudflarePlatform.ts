import type { Crypto, Info, Platform } from '@launchdarkly/js-server-sdk-common';
import CloudflareCrypto from './CloudflareCrypto';
import CloudflareInfo from './CloudflareInfo';

export default class CloudflarePlatform implements Platform {
  info: Info = new CloudflareInfo();

  crypto: Crypto = new CloudflareCrypto();
}
