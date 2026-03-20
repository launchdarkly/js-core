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
   * Applies partial updates by inserting or replacing entries without
   * version checks. Used by FDv2 where ordering is handled at the
   * protocol layer.
   */
  applyPartial(updates: { [key: string]: ItemDescriptor }): void;
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
    applyPartial(updates: { [key: string]: ItemDescriptor }) {
      Object.entries(updates).forEach(([key, descriptor]) => {
        flags[key] = descriptor;
      });
    },
  };
}
