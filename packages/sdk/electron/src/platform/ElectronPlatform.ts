import { createSafeStorage, LDLogger, platform } from '@launchdarkly/js-client-sdk-common';

import type { ValidatedOptions } from '../options';
import ElectronCrypto from './ElectronCrypto';
import ElectronEncoding from './ElectronEncoding';
import ElectronInfo from './ElectronInfo';
import ElectronRequests from './ElectronRequests';
import { getElectronStorage } from './ElectronStorage';

// NOTE: Because Electron main process runs on Node.js, this platform should be
// very similar to the Node server sdk platform.

export type ElectronPlatformOptions = Pick<
  ValidatedOptions,
  'enableEventCompression' | 'wrapperName' | 'wrapperVersion' | 'storage' | 'encryptStorage'
>;

export default class ElectronPlatform implements platform.Platform {
  info: platform.Info;

  crypto: platform.Crypto = new ElectronCrypto();

  encoding?: platform.Encoding = new ElectronEncoding();

  storage: platform.Storage;

  requests: platform.Requests;

  constructor(logger: LDLogger, options: ElectronPlatformOptions) {
    this.info = new ElectronInfo({
      wrapperName: options.wrapperName,
      wrapperVersion: options.wrapperVersion,
    });
    // A custom storage is application code, so every call is guarded and errors are logged. The
    // built-in singleton is created only when no custom storage is given.
    this.storage = options.storage
      ? createSafeStorage(options.storage, logger)
      : getElectronStorage(logger, { encrypt: !!options.encryptStorage });
    this.requests = new ElectronRequests(options.enableEventCompression);
  }
}
