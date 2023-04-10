import { EventEmitter } from 'node:events';
import createCallbacks from './createCallbacks';

describe('createCallbacks', () => {
  test('onError', () => {
    const emitter = new EventEmitter();
    emitter.on('error', () => {});
    emitter.emit = jest.fn();
    const { onError } = createCallbacks(emitter);
    const err = new Error('test error');
    onError(err);

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'error', err);
  });

  test('onError should not be called', () => {
    const emitter = new EventEmitter();
    emitter.emit = jest.fn();
    const { onError } = createCallbacks(emitter);
    const err = new Error('test error');
    onError(err);

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  test('onFailed', () => {
    const emitter = new EventEmitter();
    emitter.emit = jest.fn();
    const { onFailed } = createCallbacks(emitter);
    const err = new Error('test error');
    onFailed(err);

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'failed', err);
  });

  test('onReady', () => {
    const emitter = new EventEmitter();
    emitter.emit = jest.fn();
    const { onReady } = createCallbacks(emitter);
    onReady();

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'ready');
  });

  test('onUpdate should be noop', () => {
    const emitter = new EventEmitter();
    emitter.emit = jest.fn();
    const { onUpdate } = createCallbacks(emitter);

    expect(onUpdate.toString()).toEqual('() => { }');
  });

  test('hasEventListeners', () => {
    const emitter = new EventEmitter();
    emitter.emit = jest.fn();
    const { hasEventListeners } = createCallbacks(emitter);

    expect(hasEventListeners()).toBeFalsy();
  });
});
