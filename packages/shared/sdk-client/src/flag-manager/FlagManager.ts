import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import { namespaceForEnvironment } from '../storage/namespaceUtils';
import FlagPersistence from './FlagPersistence';
import { DefaultFlagStore } from './FlagStore';
import FlagUpdater, { FlagsChangeCallback } from './FlagUpdater';
import { ItemDescriptor } from './ItemDescriptor';

export interface FlagManager {
  get(key: string): ItemDescriptor | undefined;
  getAll(): { [key: string]: ItemDescriptor };
  init(context: Context, newFlags: { [key: string]: ItemDescriptor }): Promise<void>;
  upsert(context: Context, key: string, item: ItemDescriptor): Promise<boolean>;
  loadCached(context: Context): Promise<boolean>;
  on(callback: FlagsChangeCallback): void;
  off(callback: FlagsChangeCallback): void;
}

/**
 * Top level manager of flags for the client. LDClient should be using this
 * class and not any of the specific instances managed by it. Updates from
 * data sources should be directed to the [init] and [upsert] methods of this
 * class.
 */
export default class DefaultFlagManager implements FlagManager {
  private flagStore = new DefaultFlagStore();
  private flagUpdater: FlagUpdater;
  private flagPersistencePromise: Promise<FlagPersistence>;

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
    private readonly timeStamper: () => number = () => Date.now(),
  ) {
    this.flagUpdater = new FlagUpdater(this.flagStore, logger);
    this.flagPersistencePromise = this.initPersistence(
      platform,
      sdkKey,
      maxCachedContexts,
      logger,
      timeStamper,
    );
  }

  private async initPersistence(
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
      this.flagStore,
      this.flagUpdater,
      logger,
      timeStamper,
    );
  }

  /**
   * Attempts to get a flag by key from the current flags.
   */
  get(key: string): ItemDescriptor | undefined {
    return this.flagStore.get(key);
  }

  /**
   * Gets all the current flags.
   */
  getAll(): { [key: string]: ItemDescriptor } {
    return this.flagStore.getAll();
  }

  /**
   * Initializes the flag manager with data from a data source.
   * Persistence initialization is handled by {@link FlagPersistence}
   */
  async init(context: Context, newFlags: { [key: string]: ItemDescriptor }): Promise<void> {
    return (await this.flagPersistencePromise).init(context, newFlags);
  }

  /**
   * Attempt to update a flag. If the flag is for the wrong context, or
   * it is of an older version, then an update will not be performed.
   */
  async upsert(context: Context, key: string, item: ItemDescriptor): Promise<boolean> {
    return (await this.flagPersistencePromise).upsert(context, key, item);
  }

  /**
   * Asynchronously load cached values from persistence.
   */
  async loadCached(context: Context): Promise<boolean> {
    return (await this.flagPersistencePromise).loadCached(context);
  }

  /**
   * Register a flag change callback.
   */
  on(callback: FlagsChangeCallback): void {
    this.flagUpdater.on(callback);
  }

  /**
   * Unregister a flag change callback.
   */
  off(callback: FlagsChangeCallback): void {
    this.flagUpdater.off(callback);
  }
}
