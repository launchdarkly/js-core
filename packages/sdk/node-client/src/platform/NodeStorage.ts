import * as fs from 'fs/promises';
import * as path from 'path';

import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

const DEFAULT_DIR_NAME = 'ldclient-user-cache';
const STORAGE_FILE_NAME = 'ldcache.json';

const ERROR_PREFIX = {
  get: 'Error getting key from storage',
  set: 'Error setting key in storage',
  clear: 'Error clearing key from storage',
} as const;

type StorageOp = keyof typeof ERROR_PREFIX;

export default class NodeStorage implements Storage {
  private readonly _storageDir: string;
  private readonly _storageFile: string;
  private readonly _tempFile: string;
  private readonly _initialized: Promise<boolean>;
  private readonly _logger?: LDLogger;
  private _initError?: Error;
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

      return true;
    } catch (error) {
      this._initError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }

  private async _atomicWriteToFile(data: Map<string, string>): Promise<void> {
    const content = JSON.stringify(Object.fromEntries(data));
    let handle: fs.FileHandle | undefined;
    try {
      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore if temp file does not exist.
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
        } catch {
          // Ignore close errors during cleanup.
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

  private _initFailureReason(): string {
    return `not initialized${this._initError ? `: ${this._initError.message}` : ''}`;
  }

  async get(key: string): Promise<string | null> {
    const initialized = await this._initialized;
    if (!initialized) {
      this._logError('get', key, this._initFailureReason());
      return null;
    }
    return this._cache.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const initialized = await this._initialized;
    if (!initialized) {
      this._logError('set', key, this._initFailureReason());
      return;
    }
    this._cache.set(key, value);
    try {
      await this._scheduleFlush();
    } catch (error) {
      this._logError('set', key, error);
    }
  }

  async clear(key: string): Promise<void> {
    const initialized = await this._initialized;
    if (!initialized) {
      this._logError('clear', key, this._initFailureReason());
      return;
    }
    if (this._cache.has(key)) {
      this._cache.delete(key);
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

    // Batched callers chain off _flushQueue; log here so a failed write is never silently
    // masked for callers that did not directly await this flush.
    this._flushQueue = flush.catch((error) => {
      this._logger?.error(
        `Storage flush failed: ${error instanceof Error ? error.message : error}`,
      );
    });
    return flush;
  }
}

// Storage is a process-level singleton so multiple SDK instances in the same Node
// process share the same cache file. The first call's storagePath / logger wins;
// later calls ignore the arguments.
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
