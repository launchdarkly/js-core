import { LDOptions, platform } from '@launchdarkly/js-server-sdk-common';
import NodeCrypto from './NodeCrypto';
import NodeFilesystem from './NodeFilesystem';
import NodeInfo from './NodeInfo';
import NodeRequests from './NodeRequests';

export default class NodePlatform implements platform.Platform {
  info: platform.Info = new NodeInfo();

  fileSystem?: platform.Filesystem | undefined = new NodeFilesystem();

  crypto: platform.Crypto = new NodeCrypto();

  requests: platform.Requests;

  constructor(options: LDOptions) {
    this.requests = new NodeRequests(options.tlsParams, options.proxyOptions, options.logger);
  }
}
