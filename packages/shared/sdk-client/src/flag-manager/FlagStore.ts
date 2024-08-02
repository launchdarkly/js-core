import { ItemDescriptor } from './ItemDescriptor';

export default class FlagStore {
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
