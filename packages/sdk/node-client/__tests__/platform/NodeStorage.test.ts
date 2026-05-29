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

it('logs and returns sentinel values when initialization fails', async () => {
  const filePath = path.join(tmpRoot, 'not-a-dir');
  await fs.writeFile(filePath, 'sentinel', 'utf8');

  const logger = createMockLogger();
  const storage = new NodeStorage(filePath, logger);

  await expect(storage.get('alpha')).resolves.toBeNull();
  await expect(storage.set('alpha', 'one')).resolves.toBeUndefined();
  await expect(storage.clear('alpha')).resolves.toBeUndefined();

  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error getting key from storage'),
  );
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error setting key in storage'),
  );
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error clearing key from storage'),
  );
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
