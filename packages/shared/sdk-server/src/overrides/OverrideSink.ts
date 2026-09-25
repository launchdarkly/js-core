import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDFeatureStoreKindData, LDKeyedFeatureStoreItem, LDOverrideSink } from '../api/subsystems';
import { computeDependencies } from '../data_sources/DataSourceUpdates';
import DependencyTracker from '../data_sources/DependencyTracker';
import NamespacedDataSet from '../data_sources/NamespacedDataSet';
import VersionedDataKinds from '../store/VersionedDataKinds';
import OverrideLayer, { LayerContents } from './OverrideLayer';
import { ReadStore } from './ReadStoreOverlay';

const diffNamespaces = [
  VersionedDataKinds.Features.namespace,
  VersionedDataKinds.Segments.namespace,
];

/**
 * The data visible at the store read boundary: base data with override entries overlaid.
 */
type MergedView = Record<string, LDFeatureStoreKindData>;

/**
 * Returns the keys whose override entry differs between two layer snapshots. An added or removed
 * entry is always a change, even when its content matches the underlying LaunchDarkly data: the
 * override marker alone changes the served entry. Entries present in both snapshots are compared
 * by the text the source supplied, because the layer is rebuilt on every snapshot.
 */
function diffContents(
  previous: LayerContents,
  current: LayerContents,
): { seeds: NamespacedDataSet<boolean>; count: number } {
  const seeds = new NamespacedDataSet<boolean>();
  let count = 0;
  diffNamespaces.forEach((namespace) => {
    const oldItems = previous[namespace] ?? {};
    const newItems = current[namespace] ?? {};
    Object.entries(oldItems).forEach(([key, oldEntry]) => {
      const newEntry = newItems[key];
      if (!newEntry || newEntry.json !== oldEntry.json) {
        seeds.set(namespace, key, true);
        count += 1;
      }
    });
    Object.keys(newItems).forEach((key) => {
      if (!oldItems[key]) {
        seeds.set(namespace, key, true);
        count += 1;
      }
    });
  });
  return { seeds, count };
}

function mergedView(base: MergedView, contents: LayerContents): MergedView {
  const view: MergedView = {};
  diffNamespaces.forEach((namespace) => {
    const items: LDFeatureStoreKindData = { ...base[namespace] };
    Object.entries(contents[namespace] ?? {}).forEach(([key, entry]) => {
      items[key] = entry.item;
    });
    view[namespace] = items;
  });
  return view;
}

function trackerFor(view: MergedView): DependencyTracker {
  const tracker = new DependencyTracker();
  Object.entries(view).forEach(([namespace, items]) => {
    Object.entries(items).forEach(([key, item]) => {
      tracker.updateDependenciesFrom(namespace, key, computeDependencies(namespace, item));
    });
  });
  return tracker;
}

/**
 * Applies the snapshots that an override source supplies to the override layer, and notifies
 * flag change listeners of the flags each snapshot affects.
 *
 * @internal
 */
export default class OverrideSink implements LDOverrideSink {
  // Notifications for successive snapshots are computed one at a time, in order.
  private _chain: Promise<void> = Promise.resolve();

  /**
   * @param _layer The layer to write to.
   * @param _base The store that holds LaunchDarkly data, without the overlay. The merged views
   * for change computation are built from it plus the layer.
   * @param _onChange Receives the key of each flag whose evaluation may have changed.
   * @param _hasEventListeners Reports whether anything listens for flag changes.
   * @param _logger
   */
  constructor(
    private readonly _layer: OverrideLayer,
    private readonly _base: ReadStore,
    private readonly _onChange: (key: string) => void,
    private readonly _hasEventListeners: () => boolean,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Replaces the entire override layer in one assignment, then notifies listeners of every flag
   * whose merged-view evaluation may have changed. The replacement is visible to evaluations
   * when this method returns. The notifications follow, because they can need asynchronous
   * reads of the base store.
   */
  setOverrides(flags: LDKeyedFeatureStoreItem[], segments: LDKeyedFeatureStoreItem[]): void {
    const { previous, current } = this._layer.setAll(flags, segments);
    // Computing the affected flags needs the merged view before and after the replacement. Skip
    // all of that work when nothing is listening.
    if (!this._hasEventListeners()) {
      return;
    }
    this._chain = this._chain
      .then(() => this._notifyAffected(previous, current))
      .catch((err) => {
        this._logger?.error(`Unable to compute the flags affected by an override change: ${err}`);
      });
  }

  /**
   * Notifies the flags whose override entries were added, removed, or changed, plus every flag
   * that depends, directly or transitively, on any added, removed, or changed entry of either
   * kind. Dependency edges are computed over the new merged view. A flag whose edges differed in
   * the old view has a different definition in the new view, so it is already one of the changed
   * entries.
   */
  private async _notifyAffected(previous: LayerContents, current: LayerContents): Promise<void> {
    const { seeds, count } = diffContents(previous, current);
    if (count === 0) {
      return;
    }
    const base = await this._readBase();
    const tracker = trackerFor(mergedView(base, current));
    const affected = new NamespacedDataSet<boolean>();
    seeds.enumerate((namespace, key) => {
      tracker.updateModifiedItems(affected, namespace, key);
    });
    const flagKeys: string[] = [];
    affected.enumerate((namespace, key) => {
      if (namespace === VersionedDataKinds.Features.namespace) {
        flagKeys.push(key);
      }
    });
    if (flagKeys.length > 0) {
      this._logger?.debug(`Override update affected ${flagKeys.length} flag(s)`);
    }
    flagKeys.forEach((key) => this._onChange(key));
  }

  private _readBase(): Promise<MergedView> {
    return new Promise((resolve) => {
      this._base.all(VersionedDataKinds.Features, (flags) => {
        this._base.all(VersionedDataKinds.Segments, (segments) => {
          resolve({
            [VersionedDataKinds.Features.namespace]: flags,
            [VersionedDataKinds.Segments.namespace]: segments,
          });
        });
      });
    });
  }
}
