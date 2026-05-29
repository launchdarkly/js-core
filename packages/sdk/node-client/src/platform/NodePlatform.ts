import { LDLogger, platform } from '@launchdarkly/js-client-sdk-common';

import type { NodeOptions } from '../NodeOptions';
import NodeCrypto from './NodeCrypto';
import NodeEncoding from './NodeEncoding';
import NodeInfo from './NodeInfo';
import NodeRequests from './NodeRequests';
import { getNodeStorage } from './NodeStorage';

export default class NodePlatform implements platform.Platform {
  info: platform.Info = new NodeInfo();

  crypto: platform.Crypto = new NodeCrypto();

  encoding?: platform.Encoding = new NodeEncoding();

  storage: platform.Storage;

  requests: platform.Requests;

  constructor(logger: LDLogger, options: NodeOptions) {
    this.storage = getNodeStorage(options.localStoragePath, logger);
    this.requests = new NodeRequests(options.tlsParams, options.enableEventCompression);
  }
}
