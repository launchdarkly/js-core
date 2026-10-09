import { clone } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';
import { Flag } from '../evaluation/data/Flag';
import { markOverrideEntry } from '../evaluation/data/overrideMarker';
import { Segment } from '../evaluation/data/Segment';
import { processFlag, processSegment } from '../store/serialization';
import VersionedDataKinds from '../store/VersionedDataKinds';
import { validateFlag, validateSegment } from './validateDefinition';

/**
 * The entries of one kind, keyed by item key. Each entry is the prepared, marked copy of a
 * definition the source supplied.
 *
 * @internal
 */
export type LayerKindContents = Record<string, LDFeatureStoreItem>;

/**
 * The entries of the layer, keyed by namespace and then by item key.
 *
 * @internal
 */
export type LayerContents = Record<string, LayerKindContents>;

/**
 * Copies a definition the source supplied, checks that the copy has the shape evaluation
 * requires, prepares the copy for evaluation the way the SDK prepares LaunchDarkly data, and
 * marks it. The source's object is never modified. The check is on the copy, because the copy is
 * what the layer stores. A definition of the wrong shape throws.
 */
function prepareFlag(item: LDKeyedFeatureStoreItem): LDFeatureStoreItem {
  const copy = clone<Record<string, any>>(item);
  validateFlag(copy);
  const flag = copy as Flag;
  processFlag(flag);
  markOverrideEntry(flag);
  return flag;
}

function prepareSegment(item: LDKeyedFeatureStoreItem): LDFeatureStoreItem {
  const copy = clone<Record<string, any>>(item);
  validateSegment(copy);
  const segment = copy as Segment;
  processSegment(segment);
  markOverrideEntry(segment);
  return segment;
}

function emptyContents(): LayerContents {
  return {
    [VersionedDataKinds.Features.namespace]: {},
    [VersionedDataKinds.Segments.namespace]: {},
  };
}

/**
 * The override store. It holds the entries the override source has loaded, keyed by flag key or
 * segment key, and is replaced wholesale on each snapshot from the source. Every entry carries
 * the override marker.
 *
 * @internal
 */
export default class OverrideLayer {
  private _contents: LayerContents = emptyContents();

  private _empty = true;

  /**
   * Replaces the entire contents of the layer in one assignment, so the layer holds exactly one
   * snapshot at any instant. Empty arrays clear the layer.
   *
   * Every definition is checked and prepared before the assignment. When one definition does
   * not have the shape evaluation requires, this method throws an Error that names the kind, the
   * key, and the field, and the layer keeps its previous contents: no part of the snapshot is
   * applied.
   *
   * @returns The previous and the new contents, for change comparison. Neither may be modified.
   */
  setAll(
    flags: LDKeyedFeatureStoreItem[],
    segments: LDKeyedFeatureStoreItem[],
  ): { previous: LayerContents; current: LayerContents } {
    const current = emptyContents();
    flags.forEach((flag) => {
      current[VersionedDataKinds.Features.namespace][flag.key] = prepareFlag(flag);
    });
    segments.forEach((segment) => {
      current[VersionedDataKinds.Segments.namespace][segment.key] = prepareSegment(segment);
    });
    const previous = this._contents;
    this._contents = current;
    this._empty = flags.length === 0 && segments.length === 0;
    return { previous, current };
  }

  /**
   * Returns the override entry for a key, if any.
   */
  get(kind: DataKind, key: string): LDFeatureStoreItem | undefined {
    if (this._empty) {
      return undefined;
    }
    return this._contents[kind.namespace]?.[key];
  }

  /**
   * Returns the entries of the given kind, keyed by item key.
   */
  all(kind: DataKind): LDFeatureStoreKindData {
    return { ...this._contents[kind.namespace] };
  }

  /**
   * Reports whether the layer holds no entries. A configured but unpopulated layer costs one
   * check per read.
   */
  isEmpty(): boolean {
    return this._empty;
  }
}
