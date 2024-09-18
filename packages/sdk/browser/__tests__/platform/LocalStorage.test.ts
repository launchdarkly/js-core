import { jest } from '@jest/globals';

import LocalStorage from '../../src/platform/LocalStorage';

it('can set values', async () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  // Storage here needs to be the global browser 'Storage' not the interface
  // for our platform.
  const spy = jest.spyOn(Storage.prototype, 'setItem');

  const storage = new LocalStorage(logger);
  storage.set('test-key', 'test-value');
  expect(spy).toHaveBeenCalledWith('test-key', 'test-value');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('can handle an error setting a value', async () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  // Storage here needs to be the global browser 'Storage' not the interface
  // for our platform.
  const spy = jest.spyOn(Storage.prototype, 'setItem');
  spy.mockImplementation(() => {
    throw new Error('bad');
  });

  const storage = new LocalStorage(logger);
  storage.set('test-key', 'test-value');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith(
    'Error setting key in localStorage: test-key, reason: Error: bad',
  );
});

it('can get values', async () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  // Storage here needs to be the global browser 'Storage' not the interface
  // for our platform.
  const spy = jest.spyOn(Storage.prototype, 'getItem');

  const storage = new LocalStorage(logger);
  storage.get('test-key');
  expect(spy).toHaveBeenCalledWith('test-key');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('can handle an error getting a value', async () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  // Storage here needs to be the global browser 'Storage' not the interface
  // for our platform.
  const spy = jest.spyOn(Storage.prototype, 'getItem');
  spy.mockImplementation(() => {
    throw new Error('bad');
  });

  const storage = new LocalStorage(logger);
  storage.get('test-key');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith(
    'Error getting key from localStorage: test-key, reason: Error: bad',
  );
});

it('can clear values', async () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  // Storage here needs to be the global browser 'Storage' not the interface
  // for our platform.
  const spy = jest.spyOn(Storage.prototype, 'removeItem');

  const storage = new LocalStorage(logger);
  storage.clear('test-key');
  expect(spy).toHaveBeenCalledWith('test-key');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('can handle an error clearing a value', async () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  // Storage here needs to be the global browser 'Storage' not the interface
  // for our platform.
  const spy = jest.spyOn(Storage.prototype, 'removeItem');
  spy.mockImplementation(() => {
    throw new Error('bad');
  });

  const storage = new LocalStorage(logger);
  storage.clear('test-key');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith(
    'Error clearing key from localStorage: test-key, reason: Error: bad',
  );
});
