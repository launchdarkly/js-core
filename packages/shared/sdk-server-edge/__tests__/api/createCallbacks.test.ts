import { EventEmitter } from 'node:events';

import { LDLogger, noop } from '@launchdarkly/js-server-sdk-common';

import createCallbacks from '../../src/api/createCallbacks';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});
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

  test('onError calls the emitter', () => {
    emitter.on('error', noop);

    const { onError } = createCallbacks(emitter);
    onError(err);

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'error', err);
  });

  test('onError does not log when there are listeners', () => {
    emitter.on('error', noop);

    const { onError } = createCallbacks(emitter, logger);
    onError(err);

    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'error', err);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  test('onError logs when there are no listeners', () => {
    const { onError } = createCallbacks(emitter, logger);
    onError(err);

    expect(logger.error).toHaveBeenNthCalledWith(1, err.message);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
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
