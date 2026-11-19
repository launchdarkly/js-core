import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

import ElectronInfo from '../../src/platform/ElectronInfo';
import ElectronPlatform from '../../src/platform/ElectronPlatform';
import ElectronRequests from '../../src/platform/ElectronRequests';
import { getElectronStorage } from '../../src/platform/ElectronStorage';

const storageInstance = { get: jest.fn(), set: jest.fn(), clear: jest.fn() };

jest.mock('../../src/platform/ElectronStorage', () => ({
  getElectronStorage: jest.fn(() => storageInstance),
}));
jest.mock('../../src/platform/ElectronInfo');
jest.mock('../../src/platform/ElectronRequests');

const logger: LDLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses the shared ElectronStorage singleton without encryption by default', () => {
  const platform = new ElectronPlatform(logger, {});

  expect(getElectronStorage).toHaveBeenCalledWith(logger, { encrypt: false });
  expect(platform.storage).toBe(storageInstance);
});

it('requests an encrypted shared cache when encryptStorage is true', () => {
  // eslint-disable-next-line no-new
  new ElectronPlatform(logger, { encryptStorage: true });

  expect(getElectronStorage).toHaveBeenCalledWith(logger, { encrypt: true });
});

it('ignores encryptStorage when a custom storage is provided', async () => {
  const customStorage = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };

  const platform = new ElectronPlatform(logger, { storage: customStorage, encryptStorage: true });
  await platform.storage.set('k', 'v');

  expect(customStorage.set).toHaveBeenCalledWith('k', 'v');
  expect(getElectronStorage).not.toHaveBeenCalled();
});

it('threads wrapperName/wrapperVersion into ElectronInfo', () => {
  // eslint-disable-next-line no-new
  new ElectronPlatform(logger, { wrapperName: 'my-wrapper', wrapperVersion: '1.2.3' });

  expect(ElectronInfo).toHaveBeenCalledWith({
    wrapperName: 'my-wrapper',
    wrapperVersion: '1.2.3',
  });
});

it('constructs ElectronRequests with enableEventCompression', () => {
  // eslint-disable-next-line no-new
  new ElectronPlatform(logger, {
    enableEventCompression: true,
  });

  expect(ElectronRequests).toHaveBeenCalledWith(true);
});

it('uses the custom storage and never creates the built-in storage when storage is provided', async () => {
  const customStorage = {
    get: jest.fn().mockResolvedValue('custom-value'),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };

  const platform = new ElectronPlatform(logger, { storage: customStorage });

  await expect(platform.storage.get('test-key')).resolves.toBe('custom-value');
  await platform.storage.set('test-key', 'val');
  await platform.storage.clear('test-key');

  expect(customStorage.get).toHaveBeenCalledWith('test-key');
  expect(customStorage.set).toHaveBeenCalledWith('test-key', 'val');
  expect(customStorage.clear).toHaveBeenCalledWith('test-key');
  expect(getElectronStorage).not.toHaveBeenCalled();
});

it('logs errors from the custom storage and keeps running', async () => {
  const failingStorage = {
    get: jest.fn().mockRejectedValue(new Error('custom get failed')),
    set: jest.fn().mockRejectedValue(new Error('custom set failed')),
    clear: jest.fn().mockRejectedValue(new Error('custom clear failed')),
  };

  const platform = new ElectronPlatform(logger, { storage: failingStorage });

  await expect(platform.storage.get('key')).resolves.toBeNull();
  await expect(platform.storage.set('key', 'val')).resolves.toBeUndefined();
  await expect(platform.storage.clear('key')).resolves.toBeUndefined();

  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error getting key from storage: key'),
  );
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error setting key in storage: key'),
  );
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error clearing key from storage: key'),
  );
});

it('returns null when the custom storage resolves a non-string value', async () => {
  const oddStorage = {
    get: jest.fn().mockResolvedValue(42),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };

  const platform = new ElectronPlatform(logger, { storage: oddStorage });

  await expect(platform.storage.get('key')).resolves.toBeNull();
});
