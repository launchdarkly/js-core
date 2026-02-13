import { LDLogger, platform } from '@launchdarkly/js-client-sdk-common';

import type { ElectronOptions } from '../ElectronOptions';
import ElectronCrypto from './ElectronCrypto';
import ElectronEncoding from './ElectronEncoding';
import ElectronInfo from './ElectronInfo';
import ElectronRequests from './ElectronRequests';
import ElectronStorage from './ElectronStorage';

// NOTE: Because Electron main process runs on Node.js, this platform should be
// very similar to the Node server sdk platform.

export default class ElectronPlatform implements platform.Platform {
  info: platform.Info = new ElectronInfo();

  crypto: platform.Crypto = new ElectronCrypto();

  encoding?: platform.Encoding = new ElectronEncoding();

  storage?: platform.Storage;

  requests: platform.Requests;

  constructor(logger: LDLogger, clientSideId: string, options: ElectronOptions) {
    const namespace = this.crypto.createHash('sha256').update(clientSideId).digest?.('base64url');
    this.storage = new ElectronStorage(namespace!, logger);
    this.requests = new ElectronRequests(
      options.tlsParams,
      options.proxyOptions,
      options.logger,
      options.enableEventCompression,
    );
  }
}
