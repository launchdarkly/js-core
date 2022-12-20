import {
  BasicLogger, BasicLoggerOptions, LDLogger, LDOptions, LDClient,
} from '@launchdarkly/js-server-sdk-common';
import LDClientImpl from './LDClientFastly';

export * from '@launchdarkly/js-server-sdk-common';

// To replace the exports from `export *` we need to name them.
// So the below exports replace them with the Node specific variants.

export { LDClient } from './api';
export { LDClientImpl };

// @ts-ignore
export function init(sdkKey: string, options: LDOptions): LDClient {
  return new LDClientImpl(sdkKey, options);
}

export function basicLogger(options: BasicLoggerOptions): LDLogger {
  return new BasicLogger(options);
}
