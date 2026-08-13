import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { createMockLogger } from '../testHelpers';
import NodeStorage, { getNodeStorage, resetNodeStorage } from '../../src/platform/NodeStorage';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-test-'));
  resetNodeStorage();
});

afterEach(async () => {
  resetNodeStorage();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

it('returns null when a key has never been written', async () => {
  const storage = new NodeStorage(tmpRoot);
  await expect(storage.get('missing')).resolves.toBeNull();
});

it('round-trips values through set and get', async () => {
  const storage = new NodeStorage(tmpRoot);
  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
});

it('overwrites a value when set is called again', async () => {
  const storage = new NodeStorage(tmpRoot);
  await storage.set('alpha', 'one');
  await storage.set('alpha', 'two');
  await expect(storage.get('alpha')).resolves.toBe('two');
});

it('clears a key so subsequent gets return null', async () => {
  const storage = new NodeStorage(tmpRoot);
  await storage.set('alpha', 'one');
  await storage.clear('alpha');
  await expect(storage.get('alpha')).resolves.toBeNull();
});

it('persists writes atomically to ldcache.json in the storage directory', async () => {
  const storage = new NodeStorage(tmpRoot);
  await storage.set('alpha', 'one');

  const onDisk = await fs.readFile(path.join(tmpRoot, 'ldcache.json'), 'utf8');
  expect(JSON.parse(onDisk)).toEqual({ alpha: 'one' });
});

it('loads prior contents from the storage file on construction', async () => {
  await fs.writeFile(
    path.join(tmpRoot, 'ldcache.json'),
    JSON.stringify({ persisted: 'value' }),
    'utf8',
  );

  const storage = new NodeStorage(tmpRoot);
  await expect(storage.get('persisted')).resolves.toBe('value');
});

it('recovers when the storage file contains invalid JSON', async () => {
  await fs.writeFile(path.join(tmpRoot, 'ldcache.json'), 'not json', 'utf8');

  const storage = new NodeStorage(tmpRoot);
  await expect(storage.get('anything')).resolves.toBeNull();
  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
});

it('does not warn on first run when the cache file does not exist', async () => {
  const logger = createMockLogger();
  const storage = new NodeStorage(tmpRoot, logger);
  await expect(storage.get('anything')).resolves.toBeNull();

  expect(logger.warn).not.toHaveBeenCalled();
});

it('does not preemptively write the cache file on first run', async () => {
  const storage = new NodeStorage(tmpRoot);
  await expect(storage.get('anything')).resolves.toBeNull();

  await expect(fs.access(path.join(tmpRoot, 'ldcache.json'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('warns when the cache file is not valid JSON', async () => {
  await fs.writeFile(path.join(tmpRoot, 'ldcache.json'), 'not json', 'utf8');

  const logger = createMockLogger();
  const storage = new NodeStorage(tmpRoot, logger);
  await expect(storage.get('anything')).resolves.toBeNull();

  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Discarding malformed flag cache'),
  );
});

it('ignores non-string values when loading the cache', async () => {
  await fs.writeFile(
    path.join(tmpRoot, 'ldcache.json'),
    JSON.stringify({ good: 'keep', obj: { nested: true }, arr: [1, 2], num: 5 }),
    'utf8',
  );

  const storage = new NodeStorage(tmpRoot);
  await expect(storage.get('good')).resolves.toBe('keep');
  await expect(storage.get('obj')).resolves.toBeNull();
  await expect(storage.get('arr')).resolves.toBeNull();
  await expect(storage.get('num')).resolves.toBeNull();
});

it('does not follow a symlink planted at the temp file path', async () => {
  const storage = new NodeStorage(tmpRoot);
  // Ensure initialization (which clears any temp file) has completed before planting.
  await storage.get('warmup');

  const victim = path.join(tmpRoot, 'victim.txt');
  await fs.writeFile(victim, 'protected', 'utf8');
  await fs.symlink(victim, path.join(tmpRoot, 'ldcache.json.tmp'));

  await storage.set('alpha', 'one');

  // The exclusive open removes the symlink and writes a fresh file, so the victim is untouched.
  await expect(fs.readFile(victim, 'utf8')).resolves.toBe('protected');
  await expect(storage.get('alpha')).resolves.toBe('one');
});

it('falls back to in-memory storage instead of following a symlinked storage directory', async () => {
  const victimDir = path.join(tmpRoot, 'victim-dir');
  await fs.mkdir(victimDir);
  const storagePath = path.join(tmpRoot, 'ldcache');
  await fs.symlink(victimDir, storagePath);

  const logger = createMockLogger();
  const storage = new NodeStorage(storagePath, logger);

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
  const victim = path.join(tmpRoot, 'victim.json');
  await fs.writeFile(victim, JSON.stringify({ secret: 'do-not-load' }), 'utf8');
  await fs.symlink(victim, path.join(tmpRoot, 'ldcache.json'));

  const logger = createMockLogger();
  const storage = new NodeStorage(tmpRoot, logger);

  // The symlinked "cache" is discarded rather than followed, so its contents never load.
  await expect(storage.get('secret')).resolves.toBeNull();
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Discarding malformed flag cache'),
  );
  expect(logger.error).not.toHaveBeenCalled();

  // The victim file itself is untouched, and the symlink has been replaced by a real file.
  await expect(fs.readFile(victim, 'utf8')).resolves.toBe(JSON.stringify({ secret: 'do-not-load' }));
  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
  const onDisk = await fs.readFile(path.join(tmpRoot, 'ldcache.json'), 'utf8');
  expect(JSON.parse(onDisk)).toEqual({ alpha: 'one' });
});

it('falls back to in-memory storage when a file occupies the storage directory path', async () => {
  // No prerelease (v0) installation has customer data to migrate, so a plain file sitting at
  // the storage directory path is just treated as a generic, unrecoverable init failure.
  const storagePath = path.join(tmpRoot, 'ldcache');
  await fs.writeFile(storagePath, 'not a directory', 'utf8');

  const logger = createMockLogger();
  const storage = new NodeStorage(storagePath, logger);

  await storage.set('alpha', 'one');
  await expect(storage.get('alpha')).resolves.toBe('one');
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Using in-memory storage as a fallback'),
  );
  expect((await fs.stat(storagePath)).isDirectory()).toBe(false);
});

it('falls back to in-memory storage and warns once when the storage directory cannot be created', async () => {
  // An intermediate path segment that is a file (rather than the storage directory itself)
  // means mkdir cannot traverse through it, so this must fall back to in-memory storage.
  const fileInThePath = path.join(tmpRoot, 'not-a-dir');
  await fs.writeFile(fileInThePath, 'sentinel', 'utf8');
  const storagePath = path.join(fileInThePath, 'subdir');

  const logger = createMockLogger();
  const storage = new NodeStorage(storagePath, logger);

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

it('falls back to in-memory storage when rewriting a discarded malformed cache fails', async () => {
  // The storage directory itself is created successfully, but the rewrite that normally follows
  // discarding a malformed cache file fails because a directory occupies the temp-file path.
  // This exercises the fallback triggering from a site other than storage-directory creation.
  await fs.writeFile(path.join(tmpRoot, 'ldcache.json'), 'not json', 'utf8');
  await fs.mkdir(path.join(tmpRoot, 'ldcache.json.tmp'));

  const logger = createMockLogger();
  const storage = new NodeStorage(tmpRoot, logger);

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
  await expect(fs.readFile(path.join(tmpRoot, 'ldcache.json'), 'utf8')).resolves.toBe('not json');
});

it('returns the same singleton across getNodeStorage calls', () => {
  const first = getNodeStorage(tmpRoot);
  const second = getNodeStorage(path.join(tmpRoot, 'ignored'));
  expect(second).toBe(first);
});

it('rebuilds the singleton after resetNodeStorage', () => {
  const first = getNodeStorage(tmpRoot);
  resetNodeStorage();
  const second = getNodeStorage(tmpRoot);
  expect(second).not.toBe(first);
});

it('warns when getNodeStorage is called with a different localStoragePath', () => {
  getNodeStorage(tmpRoot);

  const logger = createMockLogger();
  getNodeStorage(path.join(tmpRoot, 'different'), logger);

  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('different localStoragePath'),
  );
});

