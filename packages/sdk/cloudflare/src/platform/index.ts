import type { Crypto, Info, Platform, Requests } from '@launchdarkly/js-server-sdk-common';
import CloudflareCrypto from './crypto';
import CloudflareInfo from './info';
import CloudflareRequests from './requests';

export default class CloudflarePlatform implements Platform {
  info: Info = new CloudflareInfo();

  crypto: Crypto = new CloudflareCrypto();

  requests: Requests = new CloudflareRequests();
}
