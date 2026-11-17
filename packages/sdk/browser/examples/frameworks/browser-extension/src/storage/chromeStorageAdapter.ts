import type { LDStorage } from '@launchdarkly/js-client-sdk';

/**
 * Creates an {@link LDStorage} that keeps data in `chrome.storage.local`.
 *
 * A Manifest V3 service worker has no `localStorage`, so the SDK cannot use its default storage
 * there. `chrome.storage.local` is available in the service worker. Its data stays when Chrome
 * stops and restarts the worker, so the SDK can start from cached flag values.
 */
export function createChromeStorageAdapter(): LDStorage {
  const storageArea = chrome.storage.local;
  return {
    async get(key: string): Promise<string | null> {
      const result = await storageArea.get(key);
      const value = result[key];
      // Other parts of the extension can write to the same storage area, so a value is not
      // always a string.
      return typeof value === 'string' ? value : null;
    },
    async set(key: string, value: string): Promise<void> {
      await storageArea.set({ [key]: value });
    },
    async clear(key: string): Promise<void> {
      await storageArea.remove(key);
    },
  };
}
