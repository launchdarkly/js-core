import { EventEmitter } from 'node:events';

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
  onUpdate: () => {},
  hasEventListeners: () => false,
});

export default createCallbacks;
