import { EventEmitter } from 'node:events';
import {
  LDClientImpl,
  LDOptions,
  BasicLogger,
  SafeLogger,
} from '@launchdarkly/js-server-sdk-common';
import { Emits } from './Emits';
import CloudflarePlatform from './platform';

class LDClientCloudflare extends LDClientImpl {
  emitter: EventEmitter;

  constructor(sdkKey: string, options: LDOptions) {
    const emitter = new EventEmitter();
    const { logger } = options;
    const fallbackLogger = new BasicLogger({
      level: 'info',
      // eslint-disable-next-line no-console
      destination: console.error,
    });
    const finalOptions = {
      ...options,
      logger: logger ? new SafeLogger(logger, fallbackLogger) : fallbackLogger,
    };

    super(sdkKey, new CloudflarePlatform(), finalOptions, {
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
            (name) => name === 'update' || (typeof name === 'string' && name.startsWith('update:'))
          ),
    });
    this.emitter = emitter;
  }
}

export default Emits(LDClientCloudflare);
