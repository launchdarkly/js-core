import type {
  Crypto,
  Info,
  LDOptions,
  Platform,
  Requests,
} from '@launchdarkly/js-server-sdk-common';
import CloudflareCrypto from './CloudflareCrypto';
// import NodeFilesystem from './NodeFilesystem';
import CloudflareInfo from './CloudflareInfo';
// import NodeRequests from './NodeRequests';

export default class CloudflarePlatform implements Platform {
  info: Info = new CloudflareInfo();

  // fileSystem?: platform.Filesystem | undefined = new NodeFilesystem();

  crypto: Crypto = new CloudflareCrypto();

  requests: Requests;

  constructor(options: LDOptions) {
    // this.requests = new NodeRequests(options.tlsParams, options.proxyOptions, options.logger);
  }
}
