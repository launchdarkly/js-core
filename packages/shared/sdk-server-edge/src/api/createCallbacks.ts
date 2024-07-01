import { EventEmitter } from 'node:events';

import { LDLogger, noop } from '@launchdarkly/js-server-sdk-common';

const createCallbacks = (emitter: EventEmitter, logger?: LDLogger) => ({
  onError: (err: Error) => {
    if (emitter.listenerCount('error')) {
      emitter.emit('error', err);
    } else {
      logger?.error(err.message);
    }
  },
  onFailed: (err: Error) => {
    emitter.emit('failed', err);
  },
  onReady: () => {
    emitter.emit('ready');
  },
  onUpdate: noop,
  hasEventListeners: () => false,
});

export default createCallbacks;
