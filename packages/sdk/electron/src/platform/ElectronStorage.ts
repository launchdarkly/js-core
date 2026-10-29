import * as electron from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

// `userData` is the app's entire data root -- OS, user, and app code (app.setPath, OneDrive
// Known Folder Move, roaming-profile redirection) can all legitimately symlink it. Guard an
// SDK-owned subdirectory instead, so the symlink defense below actually protects a path this
// SDK created and controls rather than false-positiving on ordinary userData relocations.
const CACHE_DIR_NAME = 'ldclient-user-cache';
const PLAIN_CACHE_FILE = 'ldcache';
const ENCRYPTED_CACHE_FILE = 'ldcache.enc';

const ERROR_PREFIX = {
  set: 'Error setting key in storage',
  clear: 'Error clearing key from storage',
} as const;

type StorageOp = keyof typeof ERROR_PREFIX;

export interface ElectronStorageOptions {
  /**
   * Encrypts the cache file with Electron's `safeStorage` API and keeps it in its own file.
   */
  encrypt?: boolean;
}

export default class ElectronStorage implements Storage {
  private readonly _storageDir: string;
  private readonly _storageFile: string;
  private readonly _plainFile: string;
  private readonly _tempFile: string;
  private readonly _encrypt: boolean;
  private readonly _initialized: Promise<void>;
  private readonly _logger?: LDLogger;
  private _persistenceDisabled: boolean = false;
  private _cache: Map<string, string> = new Map();
  private _flushPending: boolean = false;
  private _flushQueue: Promise<void> = Promise.resolve();

  constructor(logger?: LDLogger, options: ElectronStorageOptions = {}) {
    this._encrypt = !!options.encrypt;
    this._storageDir = path.join(electron.app.getPath('userData'), CACHE_DIR_NAME);
    this._plainFile = path.join(this._storageDir, PLAIN_CACHE_FILE);
    this._storageFile = this._encrypt
      ? path.join(this._storageDir, ENCRYPTED_CACHE_FILE)
      : this._plainFile;
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
        throw new Error(
          `Storage directory path is a symlink, not a real directory: ${this._storageDir}`,
        );
      }

      try {
        await fs.unlink(this._tempFile);
      } catch {
        // Ignore if temp file does not exist.
      }

      if (this._encrypt) {
        // A plain-text cache is never read or kept once encryption is requested.
        await this._removePlainCache();
        if (!(await this._isEncryptionAvailable())) {
          this._persistenceDisabled = true;
          this._logger?.warn(
            'Encrypted flag cache requested, but safeStorage encryption is not available on this system. Using in-memory storage - flags will not persist across restarts and no plain-text cache is written.',
          );
          return;
        }
      }

      try {
        const fileStat = await fs.lstat(this._storageFile);
        if (!fileStat.isFile()) {
          throw new Error(`Storage file exists but is not a regular file: ${this._storageFile}`);
        }

        const data = await this._readCacheFile();
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

  // safeStorage answers only after the app `ready` event.
  private async _isEncryptionAvailable(): Promise<boolean> {
    if (!electron.app.isReady()) {
      await electron.app.whenReady();
    }
    return electron.safeStorage.isEncryptionAvailable();
  }

  private async _removePlainCache(): Promise<void> {
    // The temp file covers a plain-mode write that a crash interrupted.
    await this._removePlainFile(this._plainFile);
    await this._removePlainFile(`${this._plainFile}.tmp`);
  }

  private async _removePlainFile(file: string): Promise<void> {
    try {
      await fs.unlink(file);
      this._logger?.info(
        `Deleted the plain-text flag cache file at ${file} because the cache is encrypted.`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        this._logger?.warn(
          `Failed to delete the plain-text flag cache file at ${file}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  private async _readCacheFile(): Promise<string> {
    if (this._encrypt) {
      return electron.safeStorage.decryptString(await fs.readFile(this._storageFile));
    }
    return fs.readFile(this._storageFile, 'utf8');
  }

  private _serializeCache(data: Map<string, string>): string | Buffer {
    const content = JSON.stringify(Object.fromEntries(data));
    return this._encrypt ? electron.safeStorage.encryptString(content) : content;
  }

  private async _atomicWriteToFile(data: Map<string, string>): Promise<void> {
    const content = this._serializeCache(data);
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
          this._logger?.warn(`Failed to close storage temp file during cleanup: ${closeError}`);
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

// Storage is a singleton per mode to support multiple instances of the SDK. This has the same
// limitations as the browser sdk using the shared localStorage cache. The plain and encrypted
// caches use different files, so a client that asks for encryption never gets the plain cache.
// An encrypted storage deletes the plain cache file at init, and a plain storage writes its
// file again on its next flush.
let plainInstance: ElectronStorage | undefined;
let encryptedInstance: ElectronStorage | undefined;

// Returns `Storage`, not the concrete `ElectronStorage` class -- the class itself is never
// re-exported from the package's public entry point, and an exported function returning it
// silently breaks generated type declarations for this whole file.
export function getElectronStorage(
  logger?: LDLogger,
  options: ElectronStorageOptions = {},
): Storage {
  if (options.encrypt) {
    encryptedInstance ??= new ElectronStorage(logger, { encrypt: true });
    return encryptedInstance;
  }
  plainInstance ??= new ElectronStorage(logger, { encrypt: false });
  return plainInstance;
}

/**
 * Resets the storage singleton so the next call to {@link getElectronStorage} creates a
 * new instance.
 *
 * @remarks
 * For test use only. Lets the contract-test entity and this package's own tests reset
 * storage state between runs.
 */
export function resetElectronStorage(): void {
  plainInstance = undefined;
  encryptedInstance = undefined;
}
