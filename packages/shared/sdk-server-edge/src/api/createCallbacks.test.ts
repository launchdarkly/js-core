import { EventEmitter } from 'node:events';
import { noop } from '@launchdarkly/js-server-sdk-common';
import createCallbacks from './createCallbacks';

describe('createCallbacks', () => {
  let emitter: EventEmitter;
  const err = new Error('test error');

  beforeEach(() => {
    emitter = new EventEmitter();
    emitter.emit = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('onError', () => {
    emitter.on('error', noop);

    const { onError } = createCallbacks(emitter);
    onError(err);

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'error', err);
  });

  test('onError should not be called', () => {
    const { onError } = createCallbacks(emitter);
    onError(err);

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  test('onFailed', () => {
    const { onFailed } = createCallbacks(emitter);
    onFailed(err);

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'failed', err);
  });

  test('onReady', () => {
    const { onReady } = createCallbacks(emitter);
    onReady();

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'ready');
  });

  test('onUpdate should be noop', () => {
    const { onUpdate } = createCallbacks(emitter);

    expect(onUpdate.toString()).toEqual(noop.toString());
  });

  test('hasEventListeners', () => {
    const { hasEventListeners } = createCallbacks(emitter);

    expect(hasEventListeners()).toBeFalsy();
  });
});
