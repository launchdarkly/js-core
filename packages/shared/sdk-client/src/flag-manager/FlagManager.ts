import { Context, LDFlagValue, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

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

  // REVIEWER: My reasoning here is to have the flagmanager implementation determine
  // whether or not we can support debug plugins so I put the override methods here.
  // Would like some thoughts on this as it is a deviation from previous implementation.

  /**
   * Obtain debug override functions that allows plugins
   * to manipulate the outcome of the flags managed by
   * this manager
   *
   * @experimental This function is experimental and intended for use by LaunchDarkly tools at this time.
   */
  getDebugOverride?(): LDDebugOverride;
}

/**
 * Debug interface for plugins that need to override flag values during development.
 * This interface provides methods to temporarily override flag values that take
 * precedence over the actual flag values from LaunchDarkly. These overrides are
 * useful for testing, development, and debugging scenarios.
 *
 * @experimental This interface is experimental and intended for use by LaunchDarkly tools at this time.
 * The API may change in future versions.
 */
export interface LDDebugOverride {
  /**
   * Set an override value for a flag that takes precedence over the real flag value.
   *
   * @param flagKey The flag key.
   * @param value The override value.
   */
  setOverride(flagKey: string, value: LDFlagValue): void;

  /**
   * Remove an override value for a flag, reverting to the real flag value.
   *
   * @param flagKey The flag key.
   */
  removeOverride(flagKey: string): void;

  /**
   * Clear all override values, reverting all flags to their real values.
   */
  clearAllOverrides(): void;

  /**
   * Get all currently active flag overrides.
   *
   * @returns
   *   An object containing all active overrides as key-value pairs,
   *   where keys are flag keys and values are the overridden flag values.
   *   Returns an empty object if no overrides are active.
   */
  getAllOverrides(): { [key: string]: ItemDescriptor };
}

export default class DefaultFlagManager implements FlagManager {
  private _flagStore = new DefaultFlagStore();
  private _flagUpdater: FlagUpdater;
  private _flagPersistencePromise: Promise<FlagPersistence>;
  private _overrides?: { [key: string]: LDFlagValue };

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
    if (this._overrides && Object.prototype.hasOwnProperty.call(this._overrides, key)) {
      return this._convertValueToOverrideDescripter(this._overrides[key]);
    }

    return this._flagStore.get(key);
  }

  getAll(): { [key: string]: ItemDescriptor } {
    if (this._overrides) {
      return {
        ...this._flagStore.getAll(),
        ...Object.entries(this._overrides).reduce(
          (acc: { [key: string]: ItemDescriptor }, [key, value]) => {
            acc[key] = this._convertValueToOverrideDescripter(value);
            return acc;
          },
          {},
        ),
      };
    }
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

  private _convertValueToOverrideDescripter(value: LDFlagValue): ItemDescriptor {
    return {
      flag: {
        value,
        version: 0,
      },
      version: 0,
    };
  }

  setOverride(key: string, value: LDFlagValue) {
    if (!this._overrides) {
      this._overrides = {};
    }
    this._overrides[key] = value;
    this._flagUpdater.handleFlagChanges(null, [key], 'override');
  }

  removeOverride(flagKey: string) {
    if (!this._overrides || !Object.prototype.hasOwnProperty.call(this._overrides, flagKey)) {
      return; // No override to remove
    }

    delete this._overrides[flagKey];

    // If no more overrides, reset to undefined for performance
    if (Object.keys(this._overrides).length === 0) {
      this._overrides = undefined;
    }

    this._flagUpdater.handleFlagChanges(null, [flagKey], 'override');
  }

  clearAllOverrides() {
    if (!this._overrides) {
      return {}; // No overrides to clear, return empty object for consistency
    }

    const clearedOverrides = { ...this._overrides };
    this._overrides = undefined; // Reset to undefined
    this._flagUpdater.handleFlagChanges(null, Object.keys(clearedOverrides), 'override');
    return clearedOverrides;
  }

  getAllOverrides() {
    if (!this._overrides) {
      return {};
    }
    const result = {} as { [key: string]: ItemDescriptor };
    Object.entries(this._overrides).forEach(([key, value]) => {
      result[key] = this._convertValueToOverrideDescripter(value);
    });
    return result;
  }

  getDebugOverride(): LDDebugOverride {
    return this as LDDebugOverride;
  }
}
