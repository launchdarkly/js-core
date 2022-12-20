// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl, LDOptions,
  BasicLogger,
} from '@launchdarkly/js-server-sdk-common';

import FastlyPlatform from './platform/FastlyPlatform';

class LDClientFastly extends LDClientImpl {
  emitter: EventTarget;

  constructor(sdkKey: string, options: LDOptions) {
    const fallbackLogger = new BasicLogger({
      level: 'info',
      // eslint-disable-next-line no-console
      destination: console.error,
    });

    const emitter = new EventTarget();
    const logger = fallbackLogger;

    super(
      sdkKey,
      new FastlyPlatform({ ...options, logger }),
      { ...options, logger },
      {
        onError: (err: Error) => {
          emitter.dispatchEvent(new CustomEvent('error', { detail: err }));
        },
        onFailed: (err: Error) => {
          emitter.dispatchEvent(new CustomEvent('failed', { detail: err }));
        },
        onReady: () => {
          emitter.dispatchEvent(new Event('ready'));
        },
        onUpdate: (key: string) => {
          emitter.dispatchEvent(new CustomEvent('update', { detail: key }));
          emitter.dispatchEvent(new CustomEvent(`update:${key}`, { detail: key }));
        },
        hasEventListeners: () => false,
      },
    );

    this.emitter = emitter;
  }
}

export default LDClientFastly;
