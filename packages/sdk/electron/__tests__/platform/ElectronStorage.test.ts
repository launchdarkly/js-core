import * as fs from 'fs/promises';

import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

import ElectronStorage from '../../src/platform/ElectronStorage';

jest.mock('fs/promises');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/user/data'),
  },
}));

const namespace = 'test_namespace';
const storageFile = `/user/data/ldcache-${namespace}`;
const tempFile = `${storageFile}.tmp`;

const logger: LDLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('handles failed initialization when clearing values', async () => {
  (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('file not found'));
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage(namespace, logger);
  await storage.clear('key1');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith('Error initializing storage: write failed');
  expect(logger.error).toHaveBeenCalledWith(
    'Error clearing key from storage: key1, reason: Storage is not initialized',
  );
});

it('can clear values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage(namespace, logger);
  await storage.clear('key1');

  expect(await storage.get('key1')).toBeNull();

  expect(fs.writeFile).toHaveBeenCalledWith(
    tempFile,
    JSON.stringify({ key2: 'value2' }),
    expect.anything(),
  );
  expect(fs.rename).toHaveBeenCalledWith(tempFile, storageFile);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('does nothing when clearing a non-existent key', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage(namespace, logger);
  await storage.clear('key3');

  expect(fs.writeFile).not.toHaveBeenCalled();
  expect(fs.rename).not.toHaveBeenCalled();

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('handles error when clearing values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage(namespace, logger);
  await storage.clear('key1');

  expect(await storage.get('key1')).toEqual('value1');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith(
    'Error clearing key from storage: key1, reason: write failed',
  );
});

it('handles failed initialization when getting values', async () => {
  (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('file not found'));
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage(namespace, logger);
  const value = await storage.get('key1');

  expect(value).toBeNull();

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith('Error initializing storage: write failed');
  expect(logger.error).toHaveBeenCalledWith(
    'Error getting key from storage: key1, reason: Storage is not initialized',
  );
});

it('can get values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage(namespace, logger);
  const value = await storage.get('key1');

  expect(value).toEqual('value1');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('returns null when getting a non-existent key', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage(namespace, logger);
  const value = await storage.get('key3');

  expect(value).toBeNull();

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('handles failed initialization when setting values', async () => {
  (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('file not found'));
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage(namespace, logger);
  await storage.set('key3', 'value3');

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith('Error initializing storage: write failed');
  expect(logger.error).toHaveBeenCalledWith(
    'Error setting key in storage: key3, reason: Storage is not initialized',
  );
});

it('can set values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage(namespace, logger);
  await storage.set('key3', 'value3');

  expect(await storage.get('key3')).toEqual('value3');

  expect(fs.writeFile).toHaveBeenCalledWith(
    tempFile,
    JSON.stringify({ key1: 'value1', key2: 'value2', key3: 'value3' }),
    expect.anything(),
  );
  expect(fs.rename).toHaveBeenCalledWith(tempFile, storageFile);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('can set values with existing keys', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage(namespace, logger);
  await storage.set('key1', 'new-value1');

  expect(await storage.get('key1')).toEqual('new-value1');

  expect(fs.writeFile).toHaveBeenCalledWith(
    tempFile,
    JSON.stringify({ key1: 'new-value1', key2: 'value2' }),
    expect.anything(),
  );
  expect(fs.rename).toHaveBeenCalledWith(tempFile, storageFile);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('handles error when setting values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage(namespace, logger);
  await storage.set('key3', 'value3');

  expect(await storage.get('key3')).toBeNull();

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith(
    'Error setting key in storage: key3, reason: write failed',
  );
});
