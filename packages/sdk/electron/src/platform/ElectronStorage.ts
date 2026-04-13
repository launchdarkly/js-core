import * as electron from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { Storage } from '@launchdarkly/js-client-sdk-common';

export default class ElectronStorage implements Storage {
  private readonly _storageFile: string;
  private readonly _tempFile: string;
  private readonly _initialized: Promise<boolean>;
  private _initError?: Error;
  private _cache: Map<string, string>;
  private _flushPending: boolean = false;
  private _flushQueue: Promise<void> = Promise.resolve();

  constructor() {
    this._storageFile = path.join(electron.app.getPath('userData'), 'ldcache');
    this._tempFile = `${this._storageFile}.tmp`;
    this._cache = new Map<string, string>();
    this._initialized = this._initialize();
  }

  private async _initialize(): Promise<boolean> {
    try {
      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore error if file doesn't exist
      }

      try {
        const data = await fs.readFile(this._storageFile, 'utf8');
        const parsed = JSON.parse(data);
        this._cache = new Map(Object.entries(parsed));
      } catch {
        await this._atomicWriteToFile(this._cache);
      }

      return true;
    } catch (error) {
      this._initError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }

  private async _atomicWriteToFile(data: Map<string, string>): Promise<void> {
    try {
      const content = JSON.stringify(Object.fromEntries(data));
      await fs.writeFile(this._tempFile, content, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(this._tempFile, this._storageFile);
    } catch (error) {
      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async _throwIfNotInitialized() {
    const initialized = await this._initialized;
    if (!initialized) {
      const reason = this._initError ? `: ${this._initError.message}` : '';
      throw new Error(`Storage is not initialized${reason}`);
    }
  }

  async clear(key: string): Promise<void> {
    await this._throwIfNotInitialized();
    if (this._cache.has(key)) {
      this._cache.delete(key);
      await this._scheduleFlush();
    }
  }

  async get(key: string): Promise<string | null> {
    await this._throwIfNotInitialized();
    const value = this._cache.get(key);
    return value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this._throwIfNotInitialized();
    this._cache.set(key, value);
    await this._scheduleFlush();
  }

  private _scheduleFlush(): Promise<void> {
    if (this._flushPending) {
      return this._flushQueue;
    }
    this._flushPending = true;

    const flush = this._flushQueue.then(async () => {
      this._flushPending = false;
      await this._atomicWriteToFile(new Map(this._cache));
    });

    this._flushQueue = flush.catch(() => {});
    return flush;
  }
}

// Storage should be a singleton to support multiple instances of the SDK. This should have
// the same limitations as the browser sdk using the shared localStorage cache.
let instance: ElectronStorage | undefined;

export function getElectronStorage(): ElectronStorage {
  if (!instance) {
    instance = new ElectronStorage();
  }
  return instance;
}

/** @internal Visible for testing only. */
export function resetElectronStorage(): void {
  instance = undefined;
}
