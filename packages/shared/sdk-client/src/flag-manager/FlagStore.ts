import { internal } from '@launchdarkly/js-sdk-common';

import { ItemDescriptor } from './ItemDescriptor';

/**
 * FlagStore used to store flag data in memory.
 */
export default interface FlagStore {
  /**
   * Initializes the flag store with the given flags.
   */
  init(newFlags: { [key: string]: ItemDescriptor }): void;
  /**
   * Inserts or updates the flag with the given key and update.
   */
  insertOrUpdate(key: string, update: ItemDescriptor): void;
  /**
   * Gets the flag with the given key.
   */
  get(key: string): ItemDescriptor | undefined;
  /**
   * Gets all the flags in the flag store.
   */
  getAll(): { [key: string]: ItemDescriptor };

  /**
   * Applies a changeset to the store without version checks.
   * - `'full'`: replaces all flags.
   * - `'partial'`: merges updates into existing flags.
   * - `'none'`: no-op.
   */
  applyChanges(updates: { [key: string]: ItemDescriptor }, type: internal.PayloadType): void;
}

/**
 * Creates the default implementation of the flag store.
 */
export function createDefaultFlagStore(): FlagStore {
  let flags: { [key: string]: ItemDescriptor } = {};
  return {
    init(newFlags: { [key: string]: ItemDescriptor }) {
      flags = Object.entries(newFlags).reduce(
        (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
          acc[key] = flag;
          return acc;
        },
        {},
      );
    },
    insertOrUpdate(key: string, update: ItemDescriptor) {
      flags[key] = update;
    },
    get(key: string): ItemDescriptor | undefined {
      if (Object.prototype.hasOwnProperty.call(flags, key)) {
        return flags[key];
      }
      return undefined;
    },
    getAll(): { [key: string]: ItemDescriptor } {
      return flags;
    },
    applyChanges(updates: { [key: string]: ItemDescriptor }, type: internal.PayloadType) {
      if (type === 'full') {
        this.init(updates);
      } else if (type === 'partial') {
        Object.entries(updates).forEach(([key, descriptor]) => {
          flags[key] = descriptor;
        });
      }
    },
  };
}
