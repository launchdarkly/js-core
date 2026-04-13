import * as fs from 'fs/promises';

import ElectronStorage, {
  getElectronStorage,
  resetElectronStorage,
} from '../../src/platform/ElectronStorage';

jest.mock('fs/promises');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/user/data'),
  },
}));

const storageFile = '/user/data/ldcache';
const tempFile = `${storageFile}.tmp`;

beforeEach(() => {
  jest.clearAllMocks();
  resetElectronStorage();
});

it('throws on clear when initialization failed', async () => {
  (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('file not found'));
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage();
  await expect(storage.clear('key1')).rejects.toThrow('Storage is not initialized: write failed');
});

it('can clear values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage();
  await storage.clear('key1');

  expect(await storage.get('key1')).toBeNull();

  expect(fs.writeFile).toHaveBeenCalledWith(
    tempFile,
    JSON.stringify({ key2: 'value2' }),
    expect.anything(),
  );
  expect(fs.rename).toHaveBeenCalledWith(tempFile, storageFile);
});

it('does nothing when clearing a non-existent key', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage();
  await storage.clear('key3');

  expect(fs.writeFile).not.toHaveBeenCalled();
  expect(fs.rename).not.toHaveBeenCalled();
});

it('updates cache even when disk flush fails on clear', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage();
  // The flush error propagates so the per-client wrapper can log it
  await expect(storage.clear('key1')).rejects.toThrow('write failed');

  // Cache is updated synchronously — the in-memory state reflects the clear
  // even if the disk write failed.
  expect(await storage.get('key1')).toBeNull();
});

it('throws on get when initialization failed', async () => {
  (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('file not found'));
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage();
  await expect(storage.get('key1')).rejects.toThrow('Storage is not initialized: write failed');
});

it('can get values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage();
  const value = await storage.get('key1');

  expect(value).toEqual('value1');
});

it('returns null when getting a non-existent key', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage();
  const value = await storage.get('key3');

  expect(value).toBeNull();
});

it('throws on set when initialization failed', async () => {
  (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('file not found'));
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage();
  await expect(storage.set('key3', 'value3')).rejects.toThrow(
    'Storage is not initialized: write failed',
  );
});

it('can set values', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage();
  await storage.set('key3', 'value3');

  expect(await storage.get('key3')).toEqual('value3');

  expect(fs.writeFile).toHaveBeenCalledWith(
    tempFile,
    JSON.stringify({ key1: 'value1', key2: 'value2', key3: 'value3' }),
    expect.anything(),
  );
  expect(fs.rename).toHaveBeenCalledWith(tempFile, storageFile);
});

it('can set values with existing keys', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );

  const storage = new ElectronStorage();
  await storage.set('key1', 'new-value1');

  expect(await storage.get('key1')).toEqual('new-value1');

  expect(fs.writeFile).toHaveBeenCalledWith(
    tempFile,
    JSON.stringify({ key1: 'new-value1', key2: 'value2' }),
    expect.anything(),
  );
  expect(fs.rename).toHaveBeenCalledWith(tempFile, storageFile);
});

it('updates cache even when disk flush fails on set', async () => {
  (fs.readFile as jest.Mock).mockReturnValueOnce(
    JSON.stringify({ key1: 'value1', key2: 'value2' }),
  );
  (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

  const storage = new ElectronStorage();
  // The flush error propagates so the per-client wrapper can log it
  await expect(storage.set('key3', 'value3')).rejects.toThrow('write failed');

  // Cache is updated synchronously — the in-memory state reflects the set
  // even if the disk write failed.
  expect(await storage.get('key3')).toEqual('value3');
});

it('getElectronStorage returns the same instance on subsequent calls', () => {
  const a = getElectronStorage();
  const b = getElectronStorage();
  expect(a).toBe(b);
});

it('resetElectronStorage causes a fresh instance on next call', () => {
  const a = getElectronStorage();
  resetElectronStorage();
  const b = getElectronStorage();
  expect(a).not.toBe(b);
});
