import { LDLogger, Storage } from '@launchdarkly/js-sdk-common';

import { LDStorage } from '../api/LDStorage';

/**
 * Adapts a user-provided {@link LDStorage} into the SDK's internal {@link Storage}.
 *
 * The internal {@link Storage} contract requires implementations to never throw.
 * Since a custom {@link LDStorage} is application code, this wrapper guards every
 * call: synchronous throws and rejected promises are caught and logged, `get`
 * falls back to `null`, and `set`/`clear` resolve without surfacing the error.
 * This keeps a faulty storage implementation from crashing the host application.
 */
export default function createSafeStorage(storage: LDStorage, logger?: LDLogger): Storage {
  return {
    async get(key: string): Promise<string | null> {
      try {
        const value = await storage.get(key);
        return typeof value === 'string' ? value : null;
      } catch (error) {
        logger?.error(`Error getting key from storage: ${key}, reason: ${error}`);
        return null;
      }
    },
    async set(key: string, value: string): Promise<void> {
      try {
        await storage.set(key, value);
      } catch (error) {
        logger?.error(`Error setting key in storage: ${key}, reason: ${error}`);
      }
    },
    async clear(key: string): Promise<void> {
      try {
        await storage.clear(key);
      } catch (error) {
        logger?.error(`Error clearing key from storage: ${key}, reason: ${error}`);
      }
    },
  };
}
