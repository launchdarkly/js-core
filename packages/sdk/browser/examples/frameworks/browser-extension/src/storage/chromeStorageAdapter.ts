import type { LDStorage } from '@launchdarkly/js-client-sdk';

/**
 * Builds an {@link LDStorage} implementation backed by a Chrome extension
 * storage area (defaults to `chrome.storage.local`).
 *
 * `localStorage` is unavailable in an MV3 service worker, so the browser SDK's
 * default storage cannot be used there. `chrome.storage.local` is available in
 * the service-worker context and persists across service-worker suspend/restart
 * cycles, which is exactly what the SDK's context/flag cache needs.
 *
 * The area is injectable so it can be unit-tested with an in-memory fake.
 */
export function createChromeStorageAdapter(
  storageArea: chrome.storage.StorageArea = chrome.storage.local,
): LDStorage {
  return {
    async get(key: string): Promise<string | null> {
      const result = await storageArea.get(key);
      const value = result[key];
      // The storage area is untyped and may be shared with other parts of the
      // extension, so a stored value isn't guaranteed to be a string.
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
