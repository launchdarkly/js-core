import { ItemDescriptor } from './ItemDescriptor';

/**
 * This interface exists for testing purposes
 */
export default interface FlagStore {
  init(newFlags: { [key: string]: ItemDescriptor }): void;
  insertOrUpdate(key: string, update: ItemDescriptor): void;
  get(key: string): ItemDescriptor | undefined;
  getAll(): { [key: string]: ItemDescriptor };
}

/**
 * In memory flag store.
 */
export class DefaultFlagStore implements FlagStore {
  private flags: { [key: string]: ItemDescriptor } = {};

  init(newFlags: { [key: string]: ItemDescriptor }) {
    this.flags = Object.entries(newFlags).reduce(
      (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
        acc[key] = flag;
        return acc;
      },
      {},
    );
  }

  insertOrUpdate(key: string, update: ItemDescriptor) {
    this.flags[key] = update;
  }

  get(key: string): ItemDescriptor | undefined {
    if (Object.prototype.hasOwnProperty.call(this.flags, key)) {
      return this.flags[key];
    }
    return undefined;
  }

  getAll(): { [key: string]: ItemDescriptor } {
    return this.flags;
  }
}
