import { EventEmitter } from 'node:events';

import { noop } from '@launchdarkly/js-server-sdk-common';

const createCallbacks = (emitter: EventEmitter) => ({
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
  onUpdate: noop,
  hasEventListeners: () => false,
});

export default createCallbacks;
