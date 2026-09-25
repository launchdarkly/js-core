import { DataKind } from '../api/interfaces';
import { LDFeatureStore, LDFeatureStoreItem, LDFeatureStoreKindData } from '../api/subsystems';
import OverrideLayer from './OverrideLayer';

/**
 * The store read boundary: the operations through which the client reads definitions.
 *
 * @internal
 */
export type ReadStore = Pick<LDFeatureStore, 'get' | 'all' | 'initialized'>;

/**
 * Merges an override layer over a base store. A read for a key returns the override entry when
 * one exists, and the base entry otherwise. The overlay sits at the store read boundary. That
 * placement makes targeting rules, prerequisites, and segment matches behave identically for
 * overridden and ordinary data: they are the same reads through the same boundary.
 *
 * @internal
 */
export default class ReadStoreOverlay implements ReadStore {
  constructor(
    private readonly _base: ReadStore,
    private readonly _layer: OverrideLayer,
  ) {}

  /**
   * Returns the override entry for the key when one exists, and otherwise delegates to the base
   * store. This works when the base store is not initialized, because an uninitialized base
   * reports not found.
   */
  get(kind: DataKind, key: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    const item = this._layer.get(kind, key);
    if (item) {
      callback(item);
      return;
    }
    this._base.get(kind, key, callback);
  }

  /**
   * Returns the union of the base store's items and the layer's items. The override entry wins
   * for any key present in both, including a key the base holds as a deleted item.
   */
  all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    if (this._layer.isEmpty()) {
      this._base.all(kind, callback);
      return;
    }
    this._base.all(kind, (baseItems) => {
      callback({ ...baseItems, ...this._layer.all(kind) });
    });
  }

  /**
   * Delegates to the base store. The override layer never affects initialization status.
   */
  initialized(callback: (isInitialized: boolean) => void): void {
    this._base.initialized(callback);
  }
}
