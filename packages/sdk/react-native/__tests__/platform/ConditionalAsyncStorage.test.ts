import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

import getAsyncStorage from '../../src/platform/ConditionalAsyncStorage';

// Do NOT use the global jest setup mock for async-storage in this file.
// We need to test what happens when the require fails.
jest.mock('@react-native-async-storage/async-storage', () => {
  throw new Error('Cannot find module @react-native-async-storage/async-storage');
});

describe('ConditionalAsyncStorage in-memory fallback', () => {
  let logger: LDLogger;
  let storage: any;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    storage = getAsyncStorage(logger);
  });

  it('logs a warning when AsyncStorage is unavailable', () => {
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('AsyncStorage is not available'),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('in-memory storage as a fallback'),
    );
  });

  it('returns null for keys that have not been set', async () => {
    const value = await storage.getItem('nonexistent');
    expect(value).toBeNull();
  });

  it('stores and retrieves values within the session', async () => {
    await storage.setItem('flag-key', '{"flagA":true}');
    const value = await storage.getItem('flag-key');
    expect(value).toBe('{"flagA":true}');
  });

  it('overwrites existing values', async () => {
    await storage.setItem('key', 'first');
    await storage.setItem('key', 'second');
    const value = await storage.getItem('key');
    expect(value).toBe('second');
  });

  it('removes values', async () => {
    await storage.setItem('key', 'value');
    await storage.removeItem('key');
    const value = await storage.getItem('key');
    expect(value).toBeNull();
  });

  it('removing a nonexistent key does not throw', async () => {
    await expect(storage.removeItem('nonexistent')).resolves.toBeUndefined();
  });

  it('isolates storage between separate fallback instances', async () => {
    const otherLogger: LDLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const otherStorage = getAsyncStorage(otherLogger);

    await storage.setItem('key', 'from-first');
    await expect(otherStorage.getItem('key')).resolves.toBeNull();
  });
});
