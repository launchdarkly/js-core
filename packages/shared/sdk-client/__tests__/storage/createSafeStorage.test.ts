import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDStorage } from '../../src/api/LDStorage';
import createSafeStorage from '../../src/storage/createSafeStorage';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

it('passes values through from a well-behaved implementation', async () => {
  const underlying: LDStorage = {
    get: jest.fn(async () => 'value'),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  const safe = createSafeStorage(underlying, logger);

  expect(await safe.get('key')).toEqual('value');
  await safe.set('key', 'value');
  await safe.clear('key');

  expect(underlying.get).toHaveBeenCalledWith('key');
  expect(underlying.set).toHaveBeenCalledWith('key', 'value');
  expect(underlying.clear).toHaveBeenCalledWith('key');
  expect(logger.error).not.toHaveBeenCalled();
});

it('returns null and logs when get throws synchronously', async () => {
  const underlying: LDStorage = {
    get: jest.fn(() => {
      throw new Error('boom');
    }),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  const safe = createSafeStorage(underlying, logger);

  expect(await safe.get('key')).toBeNull();
  expect(logger.error).toHaveBeenCalledTimes(1);
});

it('returns null and logs when get rejects', async () => {
  const underlying: LDStorage = {
    get: jest.fn(async () => {
      throw new Error('boom');
    }),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  const safe = createSafeStorage(underlying, logger);

  expect(await safe.get('key')).toBeNull();
  expect(logger.error).toHaveBeenCalledTimes(1);
});

it('does not throw and logs when set rejects', async () => {
  const underlying: LDStorage = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => {
      throw new Error('boom');
    }),
    clear: jest.fn(async () => {}),
  };
  const safe = createSafeStorage(underlying, logger);

  await expect(safe.set('key', 'value')).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalledTimes(1);
});

it('does not throw and logs when clear rejects', async () => {
  const underlying: LDStorage = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {
      throw new Error('boom');
    }),
  };
  const safe = createSafeStorage(underlying, logger);

  await expect(safe.clear('key')).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalledTimes(1);
});

it('coerces a non-string get result to null', async () => {
  const underlying = {
    get: jest.fn(async () => ({}) as unknown as string),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  const safe = createSafeStorage(underlying, logger);

  expect(await safe.get('key')).toBeNull();
});
