import { Context, LDLogger } from '@launchdarkly/js-sdk-common';

import calculateChangedKeys from './calculateChangedKeys';
import FlagStore from './FlagStore';
import { ItemDescriptor } from './ItemDescriptor';

export type FlagChangeType = 'init' | 'patch' | 'override';

/**
 * This callback indicates that the details associated with one or more flags
 * have changed.
 *
 * This could be the value of the flag, but it could also include changes
 * to the evaluation reason, such as being included in an experiment.
 *
 * It can include new or deleted flags as well, so an evaluation may result
 * in a FLAG_NOT_FOUND reason.
 *
 * This event does not include the value of the flag. It is expected that you
 * will call a variation method for flag values which you require.
 */
export type FlagsChangeCallback = (
  context: Context,
  flagKeys: Array<string>,
  type: FlagChangeType,
) => void;

/**
 * The flag updater handles logic required during the flag update process.
 * It handles versions checking to handle out of order flag updates and
 * also handles flag comparisons for change notification.
 */
export interface FlagUpdater {
  /**
   * Handles the flag changes by calling the change callbacks.
   *
   * @param keys keys of the flags that changed
   * @param type type of change that occurred see {@link FlagChangeType}
   */
  handleFlagChanges(keys: string[], type: FlagChangeType): void;

  /**
   * Initializes the flag updater with the given context and flags.
   * This will be called every time a new context is identified.
   *
   * @param context the context to initialize the flag updater with
   * @param newFlags the flags to initialize the flag updater with
   */
  init(context: Context, newFlags: { [key: string]: ItemDescriptor }): void;

  initCached(context: Context, newFlags: { [key: string]: ItemDescriptor }): void;

  /**
   * Upserts the flag with the given key and item.
   *
   * @param context the context to upsert the flag with
   * @param key the key of the flag to upsert
   * @param item the item to upsert the flag with
   * @returns true if the flag was upserted, false otherwise
   */
  upsert(context: Context, key: string, item: ItemDescriptor): boolean;

  /**
   * Registers a callback to be called when the flags change.
   *
   * @param callback the callback to register
   */
  on(callback: FlagsChangeCallback): void;

  /**
   * Unregisters a callback to be called when the flags change.
   *
   * @param callback the callback to unregister
   */
  off(callback: FlagsChangeCallback): void;
}

export default function createFlagUpdater(_flagStore: FlagStore, _logger: LDLogger): FlagUpdater {
  const flagStore: FlagStore = _flagStore;
  const logger: LDLogger = _logger;
  let activeContext: Context | undefined;
  const changeCallbacks = new Array<FlagsChangeCallback>();

  return {
    handleFlagChanges(keys: string[], type: FlagChangeType): void {
      if (activeContext) {
        changeCallbacks.forEach((callback) => {
          try {
            callback(activeContext!, keys, type);
          } catch (err) {
            /* intentionally empty */
          }
        });
      } else {
        logger.warn(
          'Received a change event without an active context. Changes will not be propagated.',
        );
      }
    },

    init(context: Context, newFlags: { [key: string]: ItemDescriptor }) {
      activeContext = context;
      const oldFlags = flagStore.getAll();
      flagStore.init(newFlags);
      const changed = calculateChangedKeys(oldFlags, newFlags);
      if (changed.length > 0) {
        this.handleFlagChanges(changed, 'init');
      }
    },
    initCached(context: Context, newFlags: { [key: string]: ItemDescriptor }) {
      if (activeContext?.canonicalKey === context.canonicalKey) {
        return;
      }

      this.init(context, newFlags);
    },

    upsert(context: Context, key: string, item: ItemDescriptor): boolean {
      if (activeContext?.canonicalKey !== context.canonicalKey) {
        logger.warn('Received an update for an inactive context.');
        return false;
      }

      const currentValue = flagStore.get(key);
      if (currentValue !== undefined && currentValue.version >= item.version) {
        // this is an out of order update that can be ignored
        return false;
      }

      flagStore.insertOrUpdate(key, item);
      this.handleFlagChanges([key], 'patch');
      return true;
    },

    on(callback: FlagsChangeCallback): void {
      changeCallbacks.push(callback);
    },

    off(callback: FlagsChangeCallback): void {
      const index = changeCallbacks.indexOf(callback);
      if (index > -1) {
        changeCallbacks.splice(index, 1);
      }
    },
  };
}
