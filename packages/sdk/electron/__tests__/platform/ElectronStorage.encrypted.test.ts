import { safeStorage } from 'electron';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import ElectronStorage, {
  getElectronStorage,
  resetElectronStorage,
} from '../../src/platform/ElectronStorage';
import { createMockLogger } from '../testHelpers';

let tmpRoot: string;
let userDataPath: string;
let cacheDir: string;

const mockState = { appReady: true, encryptionAvailable: true };
const mockWhenReady = jest.fn(() => Promise.resolve());

// A reversible stand-in for safeStorage: a marker prefix plus the reversed UTF-8 bytes. It is
// enough to show that the file on disk is not the plain JSON and that reads go through
// decryptString.
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => userDataPath),
    isReady: jest.fn(() => mockState.appReady),
    whenReady: () => mockWhenReady(),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => mockState.encryptionAvailable),
    encryptString: jest.fn((plainText: string) =>
      Buffer.concat([Buffer.from('ENC:'), Buffer.from(plainText, 'utf8').reverse()]),
    ),
    decryptString: jest.fn((encrypted: Buffer) => {
      if (!encrypted.subarray(0, 4).equals(Buffer.from('ENC:'))) {
        throw new Error('Decryption failed');
      }
      return Buffer.from(encrypted.subarray(4)).reverse().toString('utf8');
    }),
  },
}));

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'electron-storage-enc-test-'));
  userDataPath = tmpRoot;
  cacheDir = path.join(tmpRoot, 'ldclient-user-cache');
  mockState.appReady = true;
  mockState.encryptionAvailable = true;
  mockWhenReady.mockClear();
  (safeStorage.isEncryptionAvailable as jest.Mock).mockClear();
});

afterEach(async () => {
  resetElectronStorage();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

it('writes an encrypted cache file and no plain-text file', async () => {
  const storage = new ElectronStorage(createMockLogger(), { encrypt: true });
  await storage.set('alpha', 'one');

  const onDisk = await fs.readFile(path.join(cacheDir, 'ldcache.enc'));
  expect(onDisk.subarray(0, 4).toString()).toBe('ENC:');
  expect(onDisk.toString('utf8')).not.toContain('"alpha"');
  await expect(fs.access(path.join(cacheDir, 'ldcache'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('loads values from the encrypted cache file on construction', async () => {
  const first = new ElectronStorage(createMockLogger(), { encrypt: true });
  await first.set('alpha', 'one');

  const second = new ElectronStorage(createMockLogger(), { encrypt: true });
  await expect(second.get('alpha')).resolves.toBe('one');
});

it('deletes an existing plain-text cache and does not load its values', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'ldcache'), JSON.stringify({ secret: 'plain' }), 'utf8');

  const storage = new ElectronStorage(createMockLogger(), { encrypt: true });

  await expect(storage.get('secret')).resolves.toBeNull();
  await expect(fs.access(path.join(cacheDir, 'ldcache'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('keeps flags in memory only and writes no file when encryption is unavailable', async () => {
  mockState.encryptionAvailable = false;
  const logger = createMockLogger();
  const storage = new ElectronStorage(logger, { encrypt: true });

  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');

  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('safeStorage encryption is not available'),
  );
  expect(logger.error).not.toHaveBeenCalled();
  await expect(fs.readdir(cacheDir)).resolves.toEqual([]);
});

it('deletes the plain-text cache even when encryption is unavailable', async () => {
  mockState.encryptionAvailable = false;
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'ldcache'), JSON.stringify({ secret: 'plain' }), 'utf8');

  const storage = new ElectronStorage(createMockLogger(), { encrypt: true });

  await expect(storage.get('secret')).resolves.toBeNull();
  await expect(fs.readdir(cacheDir)).resolves.toEqual([]);
});

it('waits for the app ready event before using safeStorage', async () => {
  mockState.appReady = false;
  let resolveReady: () => void = () => {};
  mockWhenReady.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveReady = resolve;
    }),
  );
  const storage = new ElectronStorage(createMockLogger(), { encrypt: true });

  // Let initialization run as far as it can while the app is not ready.
  const pendingSet = storage.set('alpha', 'one');
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();

  resolveReady();
  await pendingSet;

  expect(safeStorage.isEncryptionAvailable).toHaveBeenCalledTimes(1);
  await expect(fs.access(path.join(cacheDir, 'ldcache.enc'))).resolves.toBeUndefined();
});

it('deletes a plain-text temp file left by an interrupted write', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'ldcache.tmp'), '{"secret":"plain"}', 'utf8');

  const storage = new ElectronStorage(createMockLogger(), { encrypt: true });
  await storage.get('secret');

  await expect(fs.access(path.join(cacheDir, 'ldcache.tmp'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('writes no plain-text or temp file when encryption fails at write time', async () => {
  const logger = createMockLogger();
  const storage = new ElectronStorage(logger, { encrypt: true });
  await storage.get('alpha');
  (safeStorage.encryptString as jest.Mock).mockImplementationOnce(() => {
    throw new Error('Encryption failed');
  });

  await storage.set('alpha', 'one');

  expect(logger.error).toHaveBeenCalledTimes(1);
  const files = await fs.readdir(cacheDir);
  expect(files).not.toContain('ldcache');
  expect(files.filter((f) => f.endsWith('.tmp'))).toEqual([]);
});

it('discards an encrypted cache file that cannot be decrypted and keeps working', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'ldcache.enc'), 'not encrypted', 'utf8');

  const logger = createMockLogger();
  const storage = new ElectronStorage(logger, { encrypt: true });

  await expect(storage.get('anything')).resolves.toBeNull();
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Discarding malformed flag cache'),
  );

  await storage.set('alpha', 'one');
  const second = new ElectronStorage(createMockLogger(), { encrypt: true });
  await expect(second.get('alpha')).resolves.toBe('one');
});

it('keeps writing the plain-text file when encryption is off', async () => {
  const storage = new ElectronStorage(createMockLogger(), { encrypt: false });
  await storage.set('alpha', 'one');

  const onDisk = await fs.readFile(path.join(cacheDir, 'ldcache'), 'utf8');
  expect(JSON.parse(onDisk)).toEqual({ alpha: 'one' });
});

it('returns separate shared instances for plain and encrypted callers without warning', () => {
  const logger = createMockLogger();

  const plain = getElectronStorage(logger, { encrypt: false });
  const encrypted = getElectronStorage(logger, { encrypt: true });

  expect(encrypted).not.toBe(plain);
  expect(getElectronStorage(logger, { encrypt: true })).toBe(encrypted);
  expect(logger.warn).not.toHaveBeenCalled();
});
