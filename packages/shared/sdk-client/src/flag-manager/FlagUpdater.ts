import { Context, LDLogger } from '@launchdarkly/js-sdk-common';

import calculateChangedKeys from './calculateChangedKeys';
import FlagStore from './FlagStore';
import { ItemDescriptor } from './ItemDescriptor';

export type FlagsChangeCallback = (context: Context, flagKeys: Array<string>) => void;

export default class FlagUpdater {
  private flagStore: FlagStore;
  private logger: LDLogger;
  private activeContextKey: string | undefined;
  private changeCallbacks = new Array<FlagsChangeCallback>();

  constructor(flagStore: FlagStore, logger: LDLogger) {
    this.flagStore = flagStore;
    this.logger = logger;
  }

  init(context: Context, newFlags: { [key: string]: ItemDescriptor }) {
    this.activeContextKey = context.canonicalKey;
    const oldFlags = this.flagStore.getAll();
    this.flagStore.init(newFlags);
    const changed = calculateChangedKeys(oldFlags, newFlags);
    if (changed.length > 0) {
      this.changeCallbacks.forEach((callback) => {
        try {
          callback(context, changed);
        } catch (err) {
          /* intentionally empty */
        }
      });
    }
  }

  initCached(context: Context, newFlags: { [key: string]: ItemDescriptor }) {
    if (this.activeContextKey === context.canonicalKey) {
      return;
    }

    this.init(context, newFlags);
  }

  upsert(context: Context, key: string, item: ItemDescriptor): boolean {
    if (this.activeContextKey !== context.canonicalKey) {
      this.logger.warn('Received an update for an inactive context.');
      return false;
    }

    const currentValue = this.flagStore.get(key);
    if (currentValue !== undefined && currentValue.version >= item.version) {
      // this is an out of order update that can be ignored
      return false;
    }

    this.flagStore.insertOrUpdate(key, item);
    this.changeCallbacks.forEach((callback) => {
      try {
        callback(context, [key]);
      } catch (err) {
        /* intentionally empty */
      }
    });
    return true;
  }

  on(callback: FlagsChangeCallback): void {
    this.changeCallbacks.push(callback);
  }

  off(callback: FlagsChangeCallback): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }
}
