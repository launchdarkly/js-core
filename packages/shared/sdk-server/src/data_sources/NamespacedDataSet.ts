/**
 * @internal
 */
export default class NamespacedDataSet<T> {
  private _itemsByNamespace: Record<string, Record<string, T>> = {};

  get(namespace: string, key: string): T | undefined {
    return this._itemsByNamespace[namespace]?.[key];
  }

  set(namespace: string, key: string, value: T) {
    if (!(namespace in this._itemsByNamespace)) {
      this._itemsByNamespace[namespace] = {};
    }
    this._itemsByNamespace[namespace][key] = value;
  }

  remove(namespace: string, key: string) {
    const items = this._itemsByNamespace[namespace];
    if (items) {
      delete items[key];
    }
  }

  removeAll() {
    this._itemsByNamespace = {};
  }

  enumerate(callback: (namespace: string, key: string, value: T) => void) {
    Object.entries(this._itemsByNamespace).forEach(([namespace, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        callback(namespace, key, value);
      });
    });
  }

  mergeFrom(other: NamespacedDataSet<T>) {
    other.enumerate(this.set.bind(this));
  }
}
