/**
 * @internal
 */
export default class NamespacedDataSet<T> {
  // The maps have no prototype, so a namespace or key named like a property of Object (for
  // example a flag key of "constructor" or "__proto__") is an ordinary entry.
  private _itemsByNamespace: Record<string, Record<string, T>> = Object.create(null);

  get(namespace: string, key: string): T | undefined {
    return this._itemsByNamespace[namespace]?.[key];
  }

  set(namespace: string, key: string, value: T) {
    if (!(namespace in this._itemsByNamespace)) {
      this._itemsByNamespace[namespace] = Object.create(null);
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
    this._itemsByNamespace = Object.create(null);
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
