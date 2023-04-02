import { EventEmitter } from 'events';
import {
  BasicLogger,
  BasicLoggerOptions,
  LDLogger,
  LDOptions,
  LDClient,
} from '@launchdarkly/js-server-sdk-common';

export * from '@launchdarkly/js-server-sdk-common';

export function init(sdkKey: string, options: LDOptions): LDClient & EventEmitter {}

export function basicLogger(options: BasicLoggerOptions): LDLogger {
  return new BasicLogger(options);
}
