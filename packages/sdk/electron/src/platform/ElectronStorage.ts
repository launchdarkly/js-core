import * as electron from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

export default class ElectronStorage implements Storage {
  private readonly _storageFile: string;
  private readonly _tempFile: string;
  private readonly _initialized: Promise<boolean>;
  private _cache: Map<string, string>;

  constructor(
    private readonly _namespace: string,
    private readonly _logger?: LDLogger,
  ) {
    this._storageFile = path.join(electron.app.getPath('userData'), `ldcache-${this._namespace}`);
    this._tempFile = `${this._storageFile}.tmp`;
    this._cache = new Map<string, string>();
    this._initialized = this._initialize();
  }

  private async _initialize(): Promise<boolean> {
    try {
      try {
        // Clean up any leftover temp files from crashed writes
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore error if file doesn't exist
      }

      try {
        // Populate cache if file exists
        const data = await fs.readFile(this._storageFile, 'utf8');
        const parsed = JSON.parse(data);
        this._cache = new Map(Object.entries(parsed));
      } catch {
        // If file doesn't exist, initialize with empty object
        await this._atomicWriteToFile(this._cache);
      }

      return true;
    } catch (error) {
      this._logError('Error initializing storage', error);
      return false;
    }
  }

  private async _atomicWriteToFile(data: Map<string, string>): Promise<void> {
    try {
      const content = JSON.stringify(Object.fromEntries(data));

      // Write to temporary file first
      await fs.writeFile(this._tempFile, content, { encoding: 'utf8', mode: 0o600 });

      // Rename temporary file to target file (atomic operation on most filesystems)
      await fs.rename(this._tempFile, this._storageFile);
    } catch (error) {
      try {
        await fs.unlink(this._tempFile);
      } catch (cleanupError) {
        this._logError('Error cleaning up temporary file', cleanupError);
      }
      throw error; // Re-throw the original error
    }
  }

  private _logError(message: string, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : error;
    this._logger?.error(`${message}: ${errorMessage}`);
  }

  private async _throwIfNotInitialized() {
    const initialized = await this._initialized;
    if (!initialized) {
      throw new Error('Storage is not initialized');
    }
  }

  async clear(key: string): Promise<void> {
    try {
      await this._throwIfNotInitialized();
      if (this._cache.has(key)) {
        const cacheCopy = new Map(this._cache);
        cacheCopy.delete(key);
        await this._atomicWriteToFile(cacheCopy);
        // Only update cache if write was successful
        this._cache = cacheCopy;
      }
    } catch (error) {
      this._logError(`Error clearing key from storage: ${key}, reason`, error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      await this._throwIfNotInitialized();
      const value = this._cache.get(key);
      return value ?? null;
    } catch (error) {
      this._logError(`Error getting key from storage: ${key}, reason`, error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this._throwIfNotInitialized();
      const cacheCopy = new Map(this._cache);
      cacheCopy.set(key, value);
      await this._atomicWriteToFile(cacheCopy);
      // Only update cache if write was successful
      this._cache = cacheCopy;
    } catch (error) {
      this._logError(`Error setting key in storage: ${key}, reason`, error);
    }
  }
}
