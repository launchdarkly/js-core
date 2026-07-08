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

it('forwards the logger to NodeStorage so storage init failures surface', async () => {
  const platform = new NodePlatform(logger, {
    localStoragePath: path.join(tmpRoot, 'never-created', '\0bad'),
  });
  await expect(platform.storage.get('alpha')).resolves.toBeNull();
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Using in-memory storage as a fallback'),
  );
});

it('uses a custom storage implementation when provided', async () => {
  const customStorage = {
    get: jest.fn().mockResolvedValue('custom-value'),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
  const platform = new NodePlatform(logger, { storage: customStorage });
  await expect(platform.storage.get('alpha')).resolves.toBe('custom-value');
  expect(customStorage.get).toHaveBeenCalledWith('alpha');
});

it('does not throw when a custom storage get rejects', async () => {
  const faultyStorage = {
    get: jest.fn().mockRejectedValue(new Error('disk full')),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
  const platform = new NodePlatform(logger, { storage: faultyStorage });
  await expect(platform.storage.get('alpha')).resolves.toBeNull();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error getting key from storage'));
});

it('does not throw when a custom storage set rejects', async () => {
  const faultyStorage = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockRejectedValue(new Error('disk full')),
    clear: jest.fn().mockResolvedValue(undefined),
  };
  const platform = new NodePlatform(logger, { storage: faultyStorage });
  await expect(platform.storage.set('alpha', 'one')).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error setting key in storage'));
});

it('does not throw when a custom storage clear rejects', async () => {
  const faultyStorage = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockRejectedValue(new Error('disk full')),
  };
  const platform = new NodePlatform(logger, { storage: faultyStorage });
  await expect(platform.storage.clear('alpha')).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error clearing key from storage'));
});

it('does not throw when a custom storage get throws synchronously', async () => {
  const faultyStorage = {
    get: jest.fn().mockImplementation(() => { throw new Error('sync boom'); }),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
  const platform = new NodePlatform(logger, { storage: faultyStorage });
  await expect(platform.storage.get('alpha')).resolves.toBeNull();
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error getting key from storage'));
});

it('passes wrapperName and wrapperVersion to NodeInfo', () => {
  const platform = new NodePlatform(logger, {
    localStoragePath: tmpRoot,
    wrapperName: 'test-wrapper',
    wrapperVersion: '2.0.0',
  });
  const sdkData = platform.info.sdkData();
  expect(sdkData.wrapperName).toBe('test-wrapper');
  expect(sdkData.wrapperVersion).toBe('2.0.0');
});

it('omits wrapperName and wrapperVersion from NodeInfo when not configured', () => {
  const platform = new NodePlatform(logger, { localStoragePath: tmpRoot });
  const sdkData = platform.info.sdkData();
  expect(sdkData.wrapperName).toBeUndefined();
  expect(sdkData.wrapperVersion).toBeUndefined();
});
