// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl, LDOptions,
  BasicLogger, SafeLogger,
} from '@launchdarkly/js-server-sdk-common';

import { EventEmitter } from 'events';
import { format } from 'util';
import NodePlatform from './platform/NodePlatform';
import { Emits } from './Emits';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';
import { BigSegmentStoreStatusProvider } from './api';

class ClientEmitter extends EventEmitter {}

class LDClientNode extends LDClientImpl {
  emitter: EventEmitter;

  bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;

  constructor(sdkKey: string, options: LDOptions) {
    const fallbackLogger = new BasicLogger({
      level: 'info',
      // eslint-disable-next-line no-console
      destination: console.error,
      formatter: format,
    });

    const emitter = new ClientEmitter();

    const logger = options.logger ? new SafeLogger(options.logger, fallbackLogger) : fallbackLogger;
    super(
      sdkKey,
      new NodePlatform({ ...options, logger }),
      { ...options, logger },
      (err: Error) => {
        if (emitter.listenerCount('error')) {
          emitter.emit('error', err);
        }
      },
      (err: Error) => {
        emitter.emit('failed', err);
      },
      () => {
        emitter.emit('ready');
      },
      (key: string) => {
        emitter.emit('update', { key });
        emitter.emit(`update:${key}`);
      },
      () => emitter.eventNames().some((name) => name === 'update' || (typeof name === 'string' && name.startsWith('update:'))),
    );
    this.emitter = emitter;

    this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode(
      this.bigSegmentStatusProviderInternal,
    ) as BigSegmentStoreStatusProvider;
  }
}

export default Emits(LDClientNode);
