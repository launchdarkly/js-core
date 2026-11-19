import * as electron from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

// OS, user, and app code can all relocate `userData`, sometimes through a symlink (app.setPath,
// OneDrive Known Folder Move, roaming profiles). The symlink check guards an SDK-owned
// subdirectory, so a normal `userData` move does not trip it.
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
      await fs.mkdir(this._storageDir, { recursive: true, mode: 0o700 });

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
        const unavailableReason = await this._encryptionUnavailableReason();
        if (unavailableReason) {
          this._persistenceDisabled = true;
          this._logger?.warn(
            `Encrypted flag cache requested, but ${unavailableReason}. Using in-memory storage - flags will not persist across restarts and no plain-text cache is written.`,
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

  // On Windows and Linux, safeStorage answers only after the app `ready` event.
  private async _encryptionUnavailableReason(): Promise<string | undefined> {
    if (!electron.app.isReady()) {
      await electron.app.whenReady();
    }
    if (!electron.safeStorage.isEncryptionAvailable()) {
      return 'safeStorage encryption is not available on this system';
    }
    // Without a secret store, Linux safeStorage encrypts with a hardcoded password. That does not
    // protect the cache, so the SDK does not use it.
    if (
      process.platform === 'linux' &&
      electron.safeStorage.getSelectedStorageBackend() === 'basic_text'
    ) {
      return 'safeStorage uses the Linux basic_text backend, which encrypts with a hardcoded password';
    }
    return undefined;
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
        // The temp file may not exist. Another failure, such as a permissions problem, also
        // makes the write below fail, and the handler of that write reports it.
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
// limitations as the browser SDK using the shared localStorage cache. The plain and encrypted
// caches use different files, so a client that asks for encryption never gets the plain cache.
// An encrypted storage deletes the plain cache file at init, and a plain storage writes its
// file again on its next flush.
let plainInstance: ElectronStorage | undefined;
let encryptedInstance: ElectronStorage | undefined;

// Returns `Storage`, not the concrete `ElectronStorage` class. The package entry point does not
// export the class. An exported function that returns the class breaks the generated type
// declarations for this file.
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
