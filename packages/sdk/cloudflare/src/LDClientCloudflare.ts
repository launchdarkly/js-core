// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl,
  LDOptions,
  BasicLogger,
  SafeLogger,
} from '@launchdarkly/js-server-sdk-common';

import { EventEmitter } from 'events';
import { Emits } from './Emits';
import CloudflarePlatform from './platform/CloudflarePlatform';

class LDClientCloudflare extends LDClientImpl {
  emitter: EventEmitter;
  // bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;

  constructor(sdkKey: string, options: LDOptions) {
    const fallbackLogger = new BasicLogger({
      level: 'info',
      // eslint-disable-next-line no-console
      destination: console.error,
    });

    const emitter = new EventEmitter();

    const logger = options.logger ? new SafeLogger(options.logger, fallbackLogger) : fallbackLogger;
    super(
      sdkKey,
      new CloudflarePlatform({ ...options, logger }),
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
                name === 'update' || (typeof name === 'string' && name.startsWith('update:'))
            ),
      }
    );
    this.emitter = emitter;

    // this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode(
    //   this.bigSegmentStatusProviderInternal
    // ) as BigSegmentStoreStatusProvider;
  }
}

export default Emits(LDClientCloudflare);
