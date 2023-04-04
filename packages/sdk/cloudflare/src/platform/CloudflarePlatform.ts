import type { Crypto, Info, Platform, Requests } from '@launchdarkly/js-server-sdk-common';
import CloudflareCrypto from './CloudflareCrypto';
import CloudflareInfo from './CloudflareInfo';
import CloudflareRequests from './CloudflareRequests';

export default class CloudflarePlatform implements Platform {
  info: Info = new CloudflareInfo();

  crypto: Crypto = new CloudflareCrypto();

  requests: Requests = new CloudflareRequests();
}
