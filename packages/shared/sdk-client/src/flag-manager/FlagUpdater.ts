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
  // REVIEWER: This is probably not desired, but I think there are some updates
  // such as overrides that do not really have a context? Unless I am misunderstanding
  // what context is exactly. Being able to support a null context may also help
  // with distinguishing between being in the emphemeral state between the start of
  // initialization and the end of identification and having an invalid context?
  context: Context,
  flagKeys: Array<string>,
  type: FlagChangeType,
) => void;

/**
 * The flag updater handles logic required during the flag update process.
 * It handles versions checking to handle out of order flag updates and
 * also handles flag comparisons for change notification.
 */
export default class FlagUpdater {
  private _flagStore: FlagStore;
  private _logger: LDLogger;
  private _activeContext: Context | undefined;
  private _changeCallbacks = new Array<FlagsChangeCallback>();

  constructor(flagStore: FlagStore, logger: LDLogger) {
    this._flagStore = flagStore;
    this._logger = logger;
  }

  handleFlagChanges(context: Context, keys: string[], type: FlagChangeType): void {
    this._changeCallbacks.forEach((callback) => {
      try {
        callback(context, keys, type);
      } catch (err) {
        /* intentionally empty */
      }
    });
  }

  init(context: Context, newFlags: { [key: string]: ItemDescriptor }) {
    this._activeContext = context;
    const oldFlags = this._flagStore.getAll();
    this._flagStore.init(newFlags);
    const changed = calculateChangedKeys(oldFlags, newFlags);
    if (changed.length > 0) {
      this.handleFlagChanges(context, changed, 'init');
    }
  }

  initCached(context: Context, newFlags: { [key: string]: ItemDescriptor }) {
    if (this._activeContext?.canonicalKey === context.canonicalKey) {
      return;
    }

    this.init(context, newFlags);
  }

  upsert(context: Context, key: string, item: ItemDescriptor): boolean {
    if (this._activeContext?.canonicalKey !== context.canonicalKey) {
      this._logger.warn('Received an update for an inactive context.');
      return false;
    }

    const currentValue = this._flagStore.get(key);
    if (currentValue !== undefined && currentValue.version >= item.version) {
      // this is an out of order update that can be ignored
      return false;
    }

    this._flagStore.insertOrUpdate(key, item);
    this.handleFlagChanges(this._activeContext!, [key], 'patch');
    return true;
  }

  on(callback: FlagsChangeCallback): void {
    this._changeCallbacks.push(callback);
  }

  off(callback: FlagsChangeCallback): void {
    const index = this._changeCallbacks.indexOf(callback);
    if (index > -1) {
      this._changeCallbacks.splice(index, 1);
    }
  }
}
