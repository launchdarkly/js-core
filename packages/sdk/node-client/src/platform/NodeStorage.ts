import * as fs from 'fs/promises';
import * as path from 'path';

import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

const DEFAULT_DIR_NAME = 'ldclient-user-cache';
const STORAGE_FILE_NAME = 'ldcache.json';

const ERROR_PREFIX = {
  set: 'Error setting key in storage',
  clear: 'Error clearing key from storage',
} as const;

type StorageOp = keyof typeof ERROR_PREFIX;

export default class NodeStorage implements Storage {
  private readonly _storageDir: string;
  private readonly _storageFile: string;
  private readonly _tempFile: string;
  private readonly _initialized: Promise<void>;
  private readonly _logger?: LDLogger;
  private _persistenceDisabled: boolean = false;
  private _cache: Map<string, string> = new Map();
  private _flushPending: boolean = false;
  private _flushQueue: Promise<void> = Promise.resolve();

  constructor(storagePath?: string, logger?: LDLogger) {
    this._storageDir = storagePath ?? path.join(process.cwd(), DEFAULT_DIR_NAME);
    this._storageFile = path.join(this._storageDir, STORAGE_FILE_NAME);
    this._tempFile = `${this._storageFile}.tmp`;
    this._logger = logger;
    this._initialized = this._initialize();
  }

  private async _initialize(): Promise<void> {
    try {
      await fs.mkdir(this._storageDir, { recursive: true });

      // fs.mkdir succeeds silently if the path already exists as a symlink to a directory, so a
      // pre-planted symlink would otherwise redirect where the cache is read from and written to
      // without ever surfacing as an init failure.
      if ((await fs.lstat(this._storageDir)).isSymbolicLink()) {
        throw new Error(`Storage directory path is a symlink, not a real directory: ${this._storageDir}`);
      }

      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore if temp file does not exist.
      }

      try {
        const fileStat = await fs.lstat(this._storageFile);
        if (!fileStat.isFile()) {
          throw new Error(`Storage file exists but is not a regular file: ${this._storageFile}`);
        }

        const data = await fs.readFile(this._storageFile, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const entries = Object.entries(parsed).filter(
            ([, value]) => typeof value === 'string',
          ) as [string, string][];
          this._cache = new Map(entries);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          this._logger?.warn(
            `Discarding malformed flag cache at ${this._storageFile}: ${error instanceof Error ? error.message : error}`,
          );
          await this._atomicWriteToFile(this._cache);
        }
      }
    } catch (error) {
      this._persistenceDisabled = true;
      this._logger?.warn(
        `Failed to initialize local flag cache at ${this._storageDir}: ${error instanceof Error ? error.message : error}. Using in-memory storage as a fallback - flags will not persist across restarts.`,
      );
    }
  }

  private async _atomicWriteToFile(data: Map<string, string>): Promise<void> {
    const content = JSON.stringify(Object.fromEntries(data));
    let handle: fs.FileHandle | undefined;
    try {
      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Either the temp file didn't exist, which we don't care about or there was
        // a problem deleting the file, for example a problem with permissions, in
        // which case the subsequent write will likely also fail and be handled by its
        // exception handler.
      }
      handle = await fs.open(this._tempFile, 'wx', 0o600);
      await handle.writeFile(content, 'utf8');
      await handle.close();
      handle = undefined;
      await fs.rename(this._tempFile, this._storageFile);
    } catch (error) {
      if (handle) {
        try {
          await handle.close();
        } catch (closeError) {
          this._logger?.warn(
            `Failed to close storage temp file during cleanup: ${closeError}`,
          );
        }
      }
      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore cleanup errors.
      }
      throw error;
    }
  }

  private _logError(op: StorageOp, key: string, reason: unknown): void {
    this._logger?.error(`${ERROR_PREFIX[op]}: ${key}, reason: ${reason}`);
  }

  async get(key: string): Promise<string | null> {
    await this._initialized;
    return this._cache.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this._initialized;
    this._cache.set(key, value);
    if (this._persistenceDisabled) {
      return;
    }
    try {
      await this._scheduleFlush();
    } catch (error) {
      this._logError('set', key, error);
    }
  }

  async clear(key: string): Promise<void> {
    await this._initialized;
    if (this._cache.has(key)) {
      this._cache.delete(key);
      if (this._persistenceDisabled) {
        return;
      }
      try {
        await this._scheduleFlush();
      } catch (error) {
        this._logError('clear', key, error);
      }
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
// process share the same cache file. The first call's storagePath wins;
// subsequent calls with a different path log a warning and return the existing instance.
let instance: NodeStorage | undefined;
let instancePath: string | undefined;

export function getNodeStorage(storagePath?: string, logger?: LDLogger): NodeStorage {
  if (!instance) {
    instance = new NodeStorage(storagePath, logger);
    instancePath = storagePath;
  } else if (storagePath !== undefined && storagePath !== instancePath) {
    logger?.warn(
      `NodeStorage was already initialized with a different localStoragePath; ignoring '${storagePath}'.`,
    );
  }
  return instance;
}

/** @internal Visible for testing only. */
export function resetNodeStorage(): void {
  instance = undefined;
  instancePath = undefined;
}
