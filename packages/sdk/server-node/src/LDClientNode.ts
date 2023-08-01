// eslint-disable-next-line max-classes-per-file
import { EventEmitter } from 'events';
import { format } from 'util';

import {
  BasicLogger,
  LDClientImpl,
  LDOptions,
  SafeLogger,
} from '@launchdarkly/js-server-sdk-common';

import { BigSegmentStoreStatusProvider } from './api';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';
import { Emits } from './Emits';
import NodePlatform from './platform/NodePlatform';

class ClientEmitter extends EventEmitter {}

/**
 * @ignore
 */
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
      {
        onError: (err: Error) => {
          if (emitter.listenerCount('error')) {
            emitter.emit('error', err);
          }
        },
        onFailed: (err: Error) => {
          emitter.emit('failed', err);
        },
        onReady: () => {
          emitter.emit('ready');
        },
        onUpdate: (key: string) => {
          emitter.emit('update', { key });
          emitter.emit(`update:${key}`, { key });
        },
        hasEventListeners: () =>
          emitter
            .eventNames()
            .some(
              (name) =>
                name === 'update' || (typeof name === 'string' && name.startsWith('update:')),
            ),
      },
    );
    this.emitter = emitter;

    this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode(
      this.bigSegmentStatusProviderInternal,
    ) as BigSegmentStoreStatusProvider;
  }
}

export default Emits(LDClientNode);
