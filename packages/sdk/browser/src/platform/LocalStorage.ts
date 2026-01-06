import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

export function isLocalStorageSupported() {
  // Checking a symbol using typeof is safe, but directly accessing a symbol
  // which is not defined would be an error.
  return typeof localStorage !== 'undefined';
}

export function getAllStorageKeys(): string[] {
  if (!isLocalStorageSupported()) {
    return [];
  }

  const keys: string[] = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Implementation of Storage using localStorage for the browser.
 *
 * The Storage API is async, and localStorage is synchronous. This is fine,
 * and none of the methods need to internally await their operations.
 */
export default class PlatformStorage implements Storage {
  constructor(private readonly _logger?: LDLogger) {}
  async clear(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this._logger?.error(`Error clearing key from localStorage: ${key}, reason: ${error}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = localStorage.getItem(key);
      return value ?? null;
    } catch (error) {
      this._logger?.error(`Error getting key from localStorage: ${key}, reason: ${error}`);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      this._logger?.error(`Error setting key in localStorage: ${key}, reason: ${error}`);
    }
  }
}
