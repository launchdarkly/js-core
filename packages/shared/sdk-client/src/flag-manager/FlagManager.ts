import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import { namespaceForEnvironment } from '../storage/namespaceUtils';
import FlagPersistence from './FlagPersistence';
import { DefaultFlagStore } from './FlagStore';
import FlagUpdater, { FlagsChangeCallback } from './FlagUpdater';
import { ItemDescriptor } from './ItemDescriptor';

/**
 * Top level manager of flags for the client. LDClient should be using this
 * interface and not any of the specific instances managed by it. Updates from
 * data sources should be directed to the [init] and [upsert] methods of this
 * interface.
 */
export interface FlagManager {
  /**
   * Attempts to get a flag by key from the current flags.
   */
  get(key: string): ItemDescriptor | undefined;

  /**
   * Gets all the current flags.
   */
  getAll(): { [key: string]: ItemDescriptor };

  /**
   * Initializes the flag manager with data from a data source.
   * Persistence initialization is handled by {@link FlagPersistence}
   */
  init(context: Context, newFlags: { [key: string]: ItemDescriptor }): Promise<void>;

  /**
   * Attempt to update a flag. If the flag is for the wrong context, or
   * it is of an older version, then an update will not be performed.
   */
  upsert(context: Context, key: string, item: ItemDescriptor): Promise<boolean>;

  /**
   * Asynchronously load cached values from persistence.
   */
  loadCached(context: Context): Promise<boolean>;

  /**
   * Updates in-memory storage with the specified flags without a context
   * or persistent storage. Flags set in this way are considered emphemeral and
   * should be replaced as soon as initialization is done.
   *
   * @param newFlags - cached flags
   */
  presetFlags(newFlags: { [key: string]: ItemDescriptor }): void;

  /**
   * Update in-memory storage with the specified flags, but do not persistent them to cache
   * storage.
   */
  setBootstrap(context: Context, newFlags: { [key: string]: ItemDescriptor }): void;

  /**
   * Register a flag change callback.
   */
  on(callback: FlagsChangeCallback): void;

  /**
   * Unregister a flag change callback.
   */
  off(callback: FlagsChangeCallback): void;
}

export default class DefaultFlagManager implements FlagManager {
  private _flagStore = new DefaultFlagStore();
  private _flagUpdater: FlagUpdater;
  private _flagPersistencePromise: Promise<FlagPersistence>;

  /**
   * @param platform implementation of various platform provided functionality
   * @param sdkKey that will be used to distinguish different environments
   * @param maxCachedContexts that specifies the max number of contexts that will be cached in persistence
   * @param logger used for logging various messages
   * @param timeStamper exists for testing purposes
   */
  constructor(
    platform: Platform,
    sdkKey: string,
    maxCachedContexts: number,
    logger: LDLogger,
    timeStamper: () => number = () => Date.now(),
  ) {
    this._flagUpdater = new FlagUpdater(this._flagStore, logger);
    this._flagPersistencePromise = this._initPersistence(
      platform,
      sdkKey,
      maxCachedContexts,
      logger,
      timeStamper,
    );
  }

  private async _initPersistence(
    platform: Platform,
    sdkKey: string,
    maxCachedContexts: number,
    logger: LDLogger,
    timeStamper: () => number = () => Date.now(),
  ): Promise<FlagPersistence> {
    const environmentNamespace = await namespaceForEnvironment(platform.crypto, sdkKey);

    return new FlagPersistence(
      platform,
      environmentNamespace,
      maxCachedContexts,
      this._flagStore,
      this._flagUpdater,
      logger,
      timeStamper,
    );
  }

  get(key: string): ItemDescriptor | undefined {
    return this._flagStore.get(key);
  }

  getAll(): { [key: string]: ItemDescriptor } {
    return this._flagStore.getAll();
  }

  presetFlags(newFlags: { [key: string]: ItemDescriptor }): void {
    this._flagStore.init(newFlags);
  }

  setBootstrap(context: Context, newFlags: { [key: string]: ItemDescriptor }): void {
    // Bypasses the persistence as we do not want to put these flags into any cache.
    // Generally speaking persistence likely *SHOULD* be disabled when using bootstrap.
    this._flagUpdater.init(context, newFlags);
  }

  async init(context: Context, newFlags: { [key: string]: ItemDescriptor }): Promise<void> {
    return (await this._flagPersistencePromise).init(context, newFlags);
  }

  async upsert(context: Context, key: string, item: ItemDescriptor): Promise<boolean> {
    return (await this._flagPersistencePromise).upsert(context, key, item);
  }

  async loadCached(context: Context): Promise<boolean> {
    return (await this._flagPersistencePromise).loadCached(context);
  }

  on(callback: FlagsChangeCallback): void {
    this._flagUpdater.on(callback);
  }

  off(callback: FlagsChangeCallback): void {
    this._flagUpdater.off(callback);
  }
}
