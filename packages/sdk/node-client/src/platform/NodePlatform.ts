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

  storage?: platform.Storage;

  requests: platform.Requests;

  constructor(logger: LDLogger, options: NodeOptions) {
    const fileStorage = getNodeStorage(options.localStoragePath);
    this.storage = {
      async get(key: string): Promise<string | null> {
        try {
          return await fileStorage.get(key);
        } catch (error) {
          logger.error(`Error getting key from storage: ${key}, reason: ${error}`);
          return null;
        }
      },
      async set(key: string, value: string): Promise<void> {
        try {
          await fileStorage.set(key, value);
        } catch (error) {
          logger.error(`Error setting key in storage: ${key}, reason: ${error}`);
        }
      },
      async clear(key: string): Promise<void> {
        try {
          await fileStorage.clear(key);
        } catch (error) {
          logger.error(`Error clearing key from storage: ${key}, reason: ${error}`);
        }
      },
    };
    this.requests = new NodeRequests(
      options.tlsParams,
      options.proxyOptions,
      options.logger,
      options.enableEventCompression,
    );
  }
}
