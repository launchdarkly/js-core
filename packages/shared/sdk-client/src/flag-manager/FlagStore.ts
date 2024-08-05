import { ItemDescriptor } from './ItemDescriptor';

/**
 * This interface exists for testing purposes
 */
interface FlagStore {
  init(newFlags: { [key: string]: ItemDescriptor }): void;
  insertOrUpdate(key: string, update: ItemDescriptor): void;
  get(key: string): ItemDescriptor | undefined;
  getAll(): { [key: string]: ItemDescriptor };
}

export default class DefaultFlagStore {
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
    return this.flags[key];
  }

  getAll(): { [key: string]: ItemDescriptor } {
    return this.flags;
  }
}
