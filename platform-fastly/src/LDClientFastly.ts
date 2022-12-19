// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl, LDOptions,
  BasicLogger, SafeLogger,
} from '@launchdarkly/js-server-sdk-common';

import { EventEmitter } from 'events';
import { format } from 'util';
import FastlyPlatform from './platform/FastlyPlatform';
import { Emits } from './Emits';

class ClientEmitter extends EventEmitter { }

class LDClientFastly extends LDClientImpl {
  emitter: EventEmitter;

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
      new FastlyPlatform({ ...options, logger }),
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
        hasEventListeners: () => emitter.eventNames().some((name) => name === 'update' || (typeof name === 'string' && name.startsWith('update:'))),
      },
    );
    this.emitter = emitter;

  }
}

export default Emits(LDClientFastly);
