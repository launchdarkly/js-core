/**
 * @internal
 */
export default class NamespacedDataSet<T> {
  private itemsByNamespace: Record<string, Record<string, T>> = {};

  get(namespace: string, key: string): T | undefined {
    return this.itemsByNamespace[namespace]?.[key];
  }

  set(namespace: string, key: string, value: T) {
    if (!(namespace in this.itemsByNamespace)) {
      this.itemsByNamespace[namespace] = {};
    }
    this.itemsByNamespace[namespace][key] = value;
  }

  remove(namespace: string, key: string) {
    const items = this.itemsByNamespace[namespace];
    if (items) {
      delete items[key];
    }
  }

  removeAll() {
    this.itemsByNamespace = {};
  }

  enumerate(callback: (namespace: string, key: string, value: T) => void) {
    Object.entries(this.itemsByNamespace).forEach(([namespace, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        callback(namespace, key, value);
      });
    });
  }

  mergeFrom(other: NamespacedDataSet<T>) {
    other.enumerate(this.set.bind(this));
  }
}
