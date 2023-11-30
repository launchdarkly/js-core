import { LDContext } from '@launchdarkly/js-sdk-common';

import LDEmitter from './LDEmitter';

describe('LDEmitter', () => {
  const error = { type: 'network', message: 'unreachable' };
  let emitter: LDEmitter;

  beforeEach(() => {
    jest.resetAllMocks();
    emitter = new LDEmitter();
  });

  test('subscribe and handle', () => {
    const errorHandler1 = jest.fn();
    const errorHandler2 = jest.fn();

    emitter.on('error', errorHandler1);
    emitter.on('error', errorHandler2);
    emitter.emit('error', error);

    expect(errorHandler1).toHaveBeenCalledWith(error);
    expect(errorHandler2).toHaveBeenCalledWith(error);
  });

  test('unsubscribe and handle', () => {
    const errorHandler1 = jest.fn();
    const errorHandler2 = jest.fn();

    emitter.on('error', errorHandler1);
    emitter.on('error', errorHandler2);
    emitter.off('error');
    emitter.emit('error', error);

    expect(errorHandler1).not.toHaveBeenCalled();
    expect(errorHandler2).not.toHaveBeenCalled();
    expect(emitter.listenerCount('error')).toEqual(0);
  });

  test('unsubscribing an event should not affect other events', () => {
    const errorHandler = jest.fn();
    const changeHandler = jest.fn();

    emitter.on('error', errorHandler);
    emitter.on('change', changeHandler);
    emitter.off('error'); // unsubscribe error handler
    emitter.emit('error', error);
    emitter.emit('change');

    // change handler should still be affective
    expect(changeHandler).toHaveBeenCalled();
    expect(errorHandler).not.toHaveBeenCalled();
  });

  test('eventNames', () => {
    const errorHandler1 = jest.fn();
    const changeHandler = jest.fn();
    const readyHandler = jest.fn();

    emitter.on('error', errorHandler1);
    emitter.on('change', changeHandler);
    emitter.on('ready', readyHandler);

    expect(emitter.eventNames()).toEqual(['error', 'change', 'ready']);
  });

  test('listener count', () => {
    const errorHandler1 = jest.fn();
    const errorHandler2 = jest.fn();
    const changeHandler = jest.fn();

    emitter.on('error', errorHandler1);
    emitter.on('error', errorHandler2);
    emitter.on('change', changeHandler);

    expect(emitter.listenerCount('error')).toEqual(2);
    expect(emitter.listenerCount('change')).toEqual(1);
  });

  test('on listener with arguments', () => {
    const context = { kind: 'user', key: 'test-user-1' };
    const onListener = jest.fn((c: LDContext) => c);

    emitter.on('change', onListener);
    emitter.emit('change', context);

    expect(onListener).toBeCalledWith(context);
  });

  test('unsubscribe one of many listeners', () => {
    const errorHandler1 = jest.fn();
    const errorHandler2 = jest.fn();

    emitter.on('error', errorHandler1);
    emitter.on('error', errorHandler2);
    emitter.off('error', errorHandler2);
    emitter.emit('error');

    expect(emitter.listenerCount('error')).toEqual(1);
    expect(errorHandler1).toBeCalled();
    expect(errorHandler2).not.toBeCalled();
  });

  test('unsubscribe all listeners manually', () => {
    const errorHandler1 = jest.fn();
    const errorHandler2 = jest.fn();

    emitter.on('error', errorHandler1);
    emitter.on('error', errorHandler2);

    // intentional duplicate calls to ensure no errors are thrown if the
    // same handler gets removed multiple times
    emitter.off('error', errorHandler1);
    emitter.off('error', errorHandler1);
    emitter.off('error', errorHandler2);
    emitter.emit('error');

    expect(emitter.listenerCount('error')).toEqual(0);
    expect(errorHandler1).not.toBeCalled();
    expect(errorHandler2).not.toBeCalled();
  });

  test('unsubscribe all listeners by event name', () => {
    const errorHandler1 = jest.fn();
    const errorHandler2 = jest.fn();

    emitter.on('error', errorHandler1);
    emitter.on('error', errorHandler2);
    emitter.off('error');
    emitter.emit('error');

    expect(emitter.listenerCount('error')).toEqual(0);
    expect(errorHandler1).not.toBeCalled();
    expect(errorHandler2).not.toBeCalled();
  });
});
