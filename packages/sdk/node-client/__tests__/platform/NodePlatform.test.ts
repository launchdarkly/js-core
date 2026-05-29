import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { createMockLogger } from '../testHelpers';
import { resetNodeStorage } from '../../src/platform/NodeStorage';
import NodePlatform from '../../src/platform/NodePlatform';

let tmpRoot: string;
let logger: ReturnType<typeof createMockLogger>;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-platform-test-'));
  resetNodeStorage();
  logger = createMockLogger();
});

afterEach(async () => {
  resetNodeStorage();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

it('exposes info, crypto, encoding, storage, and requests', () => {
  const platform = new NodePlatform(logger, { localStoragePath: tmpRoot });
  expect(platform.info).toBeDefined();
  expect(platform.crypto).toBeDefined();
  expect(platform.encoding).toBeDefined();
  expect(platform.storage).toBeDefined();
  expect(platform.requests).toBeDefined();
});

it('round-trips storage values through the file-backed NodeStorage', async () => {
  const platform = new NodePlatform(logger, { localStoragePath: tmpRoot });
  await platform.storage.set('alpha', 'one');
  await expect(platform.storage.get('alpha')).resolves.toBe('one');
  await platform.storage.clear('alpha');
  await expect(platform.storage.get('alpha')).resolves.toBeNull();
});

it('forwards the logger to NodeStorage so storage failures surface', async () => {
  const platform = new NodePlatform(logger, {
    localStoragePath: path.join(tmpRoot, 'never-created', '\0bad'),
  });
  await expect(platform.storage.get('alpha')).resolves.toBeNull();
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error getting key from storage'),
  );
});

