import { ItemDescriptor } from './ItemDescriptor';

/**
 * This interface exists for testing purposes
 */
export default interface FlagStore {
  init(newFlags: { [key: string]: ItemDescriptor }): void;
  insertOrUpdate(key: string, update: ItemDescriptor): void;

  /**
   * Applies a set of changes atomically to the flag store.
   * All changes will either succeed or fail together.
   * @param basis If true, completely overwrites the current contents of the data store
   * with the provided data.  If false, upserts the items in the provided data.
   * @param changes An object containing flag key to ItemDescriptor mappings to be applied
   */
  applyChanges(basis: boolean, changes: { [key: string]: ItemDescriptor }): void;
  get(key: string): ItemDescriptor | undefined;
  getAll(): { [key: string]: ItemDescriptor };
}

/**
 * In memory flag store.
 */
export class DefaultFlagStore implements FlagStore {
  private _flags: { [key: string]: ItemDescriptor } = {};

  init(newFlags: { [key: string]: ItemDescriptor }) {
    this._flags = Object.entries(newFlags).reduce(
      (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
        acc[key] = flag;
        return acc;
      },
      {},
    );
  }

  insertOrUpdate(key: string, update: ItemDescriptor) {
    this._flags[key] = update;
  }

  applyChanges(basis: boolean, changes: { [key: string]: ItemDescriptor }) {
    if (basis) {
      this._flags = Object.entries(changes).reduce(
        (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
          acc[key] = flag;
          return acc;
        },
        {},
      );
    } else {
      Object.entries(changes).forEach(([key, flag]) => {
        this._flags[key] = flag;
      });
    }
  }

  get(key: string): ItemDescriptor | undefined {
    if (Object.prototype.hasOwnProperty.call(this._flags, key)) {
      return this._flags[key];
    }
    return undefined;
  }

  getAll(): { [key: string]: ItemDescriptor } {
    return this._flags;
  }
}
