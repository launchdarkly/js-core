import { LDClient, LDOptions } from '@launchdarkly/js-server-sdk-common';
import { EventEmitter } from 'events';
import LDClientImpl from './LDClientNode';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';
import { BasicLogger, BasicLoggerOptions, LDLogger } from '@launchdarkly/js-sdk-common';

export * from '@launchdarkly/js-server-sdk-common';

// To replace the exports from `export *` we need to name them.
// So the below exports replace them with the Node specific variants.

export { LDClient } from './api';
export { LDClientImpl, BigSegmentStoreStatusProviderNode };

export function init(sdkKey: string, options: LDOptions): LDClient & EventEmitter {
  return new LDClientImpl(sdkKey, options);
}

export function basicLogger(options: BasicLoggerOptions): LDLogger {
  return new BasicLogger(options);
}
