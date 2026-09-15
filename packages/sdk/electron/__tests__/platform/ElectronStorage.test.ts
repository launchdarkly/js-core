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

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => userDataPath),
  },
}));

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'electron-storage-test-'));
  userDataPath = tmpRoot;
  cacheDir = path.join(tmpRoot, 'ldclient-user-cache');
  resetElectronStorage();
});

afterEach(async () => {
  resetElectronStorage();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

it('returns null when a key has never been written', async () => {
  const storage = new ElectronStorage();
  await expect(storage.get('missing')).resolves.toBeNull();
});

it('round-trips values through set and get', async () => {
  const storage = new ElectronStorage();
  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
});

it('overwrites a value when set is called again', async () => {
  const storage = new ElectronStorage();
  await storage.set('alpha', 'one');
  await storage.set('alpha', 'two');
  await expect(storage.get('alpha')).resolves.toBe('two');
});

it('clears a key so subsequent gets return null', async () => {
  const storage = new ElectronStorage();
  await storage.set('alpha', 'one');
  await storage.clear('alpha');
  await expect(storage.get('alpha')).resolves.toBeNull();
});

it('persists writes atomically to ldcache in an SDK-owned subdirectory of userData', async () => {
  const storage = new ElectronStorage();
  await storage.set('alpha', 'one');

  const onDisk = await fs.readFile(path.join(cacheDir, 'ldcache'), 'utf8');
  expect(JSON.parse(onDisk)).toEqual({ alpha: 'one' });
});

it('loads prior contents from the storage file on construction', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(
    path.join(cacheDir, 'ldcache'),
    JSON.stringify({ persisted: 'value' }),
    'utf8',
  );

  const storage = new ElectronStorage();
  await expect(storage.get('persisted')).resolves.toBe('value');
});

it('recovers when the storage file contains invalid JSON', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'ldcache'), 'not json', 'utf8');

  const storage = new ElectronStorage();
  await expect(storage.get('anything')).resolves.toBeNull();
  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
});

it('does not warn on first run when the cache file does not exist', async () => {
  const logger = createMockLogger();
  const storage = new ElectronStorage(logger);
  await expect(storage.get('anything')).resolves.toBeNull();

  expect(logger.warn).not.toHaveBeenCalled();
});

it('does not preemptively write the cache file on first run', async () => {
  const storage = new ElectronStorage();
  await expect(storage.get('anything')).resolves.toBeNull();

  await expect(fs.access(path.join(cacheDir, 'ldcache'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('warns when the cache file is not valid JSON', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'ldcache'), 'not json', 'utf8');

  const logger = createMockLogger();
  const storage = new ElectronStorage(logger);
  await expect(storage.get('anything')).resolves.toBeNull();

  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Discarding malformed flag cache'),
  );
});

it('ignores non-string values when loading the cache', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(
    path.join(cacheDir, 'ldcache'),
    JSON.stringify({ good: 'keep', obj: { nested: true }, arr: [1, 2], num: 5 }),
    'utf8',
  );

  const storage = new ElectronStorage();
  await expect(storage.get('good')).resolves.toBe('keep');
  await expect(storage.get('obj')).resolves.toBeNull();
  await expect(storage.get('arr')).resolves.toBeNull();
  await expect(storage.get('num')).resolves.toBeNull();
});

it('does not follow a symlink planted at the temp file path', async () => {
  const storage = new ElectronStorage();
  // Ensure initialization (which clears any temp file) has completed before planting.
  await storage.get('warmup');

  const victim = path.join(tmpRoot, 'victim.txt');
  await fs.writeFile(victim, 'protected', 'utf8');
  await fs.symlink(victim, path.join(cacheDir, 'ldcache.tmp'));

  await storage.set('alpha', 'one');

  // The exclusive open removes the symlink and writes a fresh file, so the victim is untouched.
  await expect(fs.readFile(victim, 'utf8')).resolves.toBe('protected');
  await expect(storage.get('alpha')).resolves.toBe('one');
});

it('falls back to in-memory storage instead of following a symlinked SDK cache directory', async () => {
  const victimDir = path.join(tmpRoot, 'victim-dir');
  await fs.mkdir(victimDir);
  await fs.symlink(victimDir, cacheDir);

  const logger = createMockLogger();
  const storage = new ElectronStorage(logger);

  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Using in-memory storage as a fallback'),
  );

  // The victim directory the symlink pointed at was never written to.
  await expect(fs.readdir(victimDir)).resolves.toEqual([]);
});

it('discards a symlink planted at the storage file path instead of reading through it', async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  const victim = path.join(tmpRoot, 'victim.json');
  await fs.writeFile(victim, JSON.stringify({ secret: 'do-not-load' }), 'utf8');
  await fs.symlink(victim, path.join(cacheDir, 'ldcache'));

  const logger = createMockLogger();
  const storage = new ElectronStorage(logger);

  // The symlinked "cache" is discarded rather than followed, so its contents never load.
  await expect(storage.get('secret')).resolves.toBeNull();
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Discarding malformed flag cache'),
  );
  expect(logger.error).not.toHaveBeenCalled();

  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
  const onDisk = await fs.readFile(path.join(cacheDir, 'ldcache'), 'utf8');
  expect(JSON.parse(onDisk)).toEqual({ alpha: 'one' });
});

it('falls back to in-memory storage and warns once when the cache directory cannot be created', async () => {
  // An intermediate path segment that is a file means mkdir cannot traverse through it, so
  // this must fall back to in-memory storage rather than throwing out of get/set/clear.
  const fileInThePath = path.join(tmpRoot, 'not-a-dir');
  await fs.writeFile(fileInThePath, 'sentinel', 'utf8');
  userDataPath = path.join(fileInThePath, 'subdir');

  const logger = createMockLogger();
  const storage = new ElectronStorage(logger);

  await expect(storage.get('alpha')).resolves.toBeNull();
  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
  await storage.clear('alpha');
  await expect(storage.get('alpha')).resolves.toBeNull();

  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Using in-memory storage as a fallback'),
  );
});

it('falls back to in-memory storage when a file occupies the cache directory path', async () => {
  // No prerelease (v0) installation has customer data to migrate, so a plain file sitting at
  // the cache directory path is just treated as a generic, unrecoverable init failure.
  await fs.writeFile(cacheDir, 'not a directory', 'utf8');

  const logger = createMockLogger();
  const storage = new ElectronStorage(logger);

  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Using in-memory storage as a fallback'),
  );
  expect((await fs.stat(cacheDir)).isDirectory()).toBe(false);
});

it('falls back to in-memory storage when rewriting a discarded malformed cache fails', async () => {
  // The cache directory itself is created successfully, but the rewrite that normally follows
  // discarding a malformed cache file fails because a directory occupies the temp-file path.
  // This exercises the fallback triggering from a site other than cache-directory creation.
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'ldcache'), 'not json', 'utf8');
  await fs.mkdir(path.join(cacheDir, 'ldcache.tmp'));

  const logger = createMockLogger();
  const storage = new ElectronStorage(logger);

  await expect(storage.get('anything')).resolves.toBeNull();
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Discarding malformed flag cache'),
  );
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Using in-memory storage as a fallback'),
  );
  expect(logger.error).not.toHaveBeenCalled();

  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');

  // Persistence is disabled, so the untouched malformed file on disk proves no flush was attempted.
  await expect(fs.readFile(path.join(cacheDir, 'ldcache'), 'utf8')).resolves.toBe('not json');
});

it('returns the same singleton across getElectronStorage calls', () => {
  const first = getElectronStorage();
  const second = getElectronStorage();
  expect(second).toBe(first);
});

it('rebuilds the singleton after resetElectronStorage', () => {
  const first = getElectronStorage();
  resetElectronStorage();
  const second = getElectronStorage();
  expect(second).not.toBe(first);
});
