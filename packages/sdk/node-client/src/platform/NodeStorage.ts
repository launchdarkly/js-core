import * as fs from 'fs/promises';
import * as path from 'path';

import type { Storage } from '@launchdarkly/js-client-sdk-common';

const DEFAULT_DIR_NAME = 'ldclient-user-cache';
const STORAGE_FILE_NAME = 'ldcache.json';

export default class NodeStorage implements Storage {
  private readonly _storageDir: string;
  private readonly _storageFile: string;
  private readonly _tempFile: string;
  private readonly _initialized: Promise<boolean>;
  private _initError?: Error;
  private _cache: Map<string, string> = new Map();
  private _flushPending: boolean = false;
  private _flushQueue: Promise<void> = Promise.resolve();

  constructor(storagePath?: string) {
    this._storageDir = storagePath ?? path.join(process.cwd(), DEFAULT_DIR_NAME);
    this._storageFile = path.join(this._storageDir, STORAGE_FILE_NAME);
    this._tempFile = `${this._storageFile}.tmp`;
    this._initialized = this._initialize();
  }

  private async _initialize(): Promise<boolean> {
    try {
      await fs.mkdir(this._storageDir, { recursive: true });

      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore if temp file does not exist.
      }

      try {
        const data = await fs.readFile(this._storageFile, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          this._cache = new Map(Object.entries(parsed as Record<string, string>));
        }
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
    const content = JSON.stringify(Object.fromEntries(data));
    try {
      await fs.writeFile(this._tempFile, content, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(this._tempFile, this._storageFile);
    } catch (error) {
      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore cleanup errors.
      }
      throw error;
    }
  }

  private async _throwIfNotInitialized(): Promise<void> {
    const initialized = await this._initialized;
    if (!initialized) {
      const reason = this._initError ? `: ${this._initError.message}` : '';
      throw new Error(`Storage is not initialized${reason}`);
    }
  }

  async get(key: string): Promise<string | null> {
    await this._throwIfNotInitialized();
    return this._cache.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this._throwIfNotInitialized();
    this._cache.set(key, value);
    await this._scheduleFlush();
  }

  async clear(key: string): Promise<void> {
    await this._throwIfNotInitialized();
    if (this._cache.has(key)) {
      this._cache.delete(key);
      await this._scheduleFlush();
    }
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

// Storage is a process-level singleton so multiple SDK instances in the same Node
// process share the same cache file (matching the electron SDK pattern). The first
// call's storagePath wins; later calls ignore the argument.
let instance: NodeStorage | undefined;

export function getNodeStorage(storagePath?: string): NodeStorage {
  if (!instance) {
    instance = new NodeStorage(storagePath);
  }
  return instance;
}

/** @internal Visible for testing only. */
export function resetNodeStorage(): void {
  instance = undefined;
}
