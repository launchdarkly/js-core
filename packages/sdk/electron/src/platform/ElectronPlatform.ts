import { LDLogger, platform } from '@launchdarkly/js-client-sdk-common';

import type { ElectronOptions } from '../ElectronOptions';
import ElectronCrypto from './ElectronCrypto';
import ElectronEncoding from './ElectronEncoding';
import ElectronInfo from './ElectronInfo';
import ElectronRequests from './ElectronRequests';
import { getElectronStorage } from './ElectronStorage';

// NOTE: Because Electron main process runs on Node.js, this platform should be
// very similar to the Node server sdk platform.

export default class ElectronPlatform implements platform.Platform {
  info: platform.Info = new ElectronInfo();

  crypto: platform.Crypto = new ElectronCrypto();

  encoding?: platform.Encoding = new ElectronEncoding();

  storage?: platform.Storage;

  requests: platform.Requests;

  constructor(logger: LDLogger, options: ElectronOptions) {
    const globalStorage = getElectronStorage();
    this.storage = {
      async get(key: string): Promise<string | null> {
        try {
          return await globalStorage.get(key);
        } catch (error) {
          logger.error(`Error getting key from storage: ${key}, reason: ${error}`);
          return null;
        }
      },
      async set(key: string, value: string): Promise<void> {
        try {
          await globalStorage.set(key, value);
        } catch (error) {
          logger.error(`Error setting key in storage: ${key}, reason: ${error}`);
        }
      },
      async clear(key: string): Promise<void> {
        try {
          await globalStorage.clear(key);
        } catch (error) {
          logger.error(`Error clearing key from storage: ${key}, reason: ${error}`);
        }
      },
    };
    this.requests = new ElectronRequests(
      options.tlsParams,
      options.proxyOptions,
      options.logger,
      options.enableEventCompression,
    );
  }
}
