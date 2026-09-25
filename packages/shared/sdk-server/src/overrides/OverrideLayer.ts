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

/**
 * One entry of the layer: the prepared, marked definition, and the JSON text of the definition
 * as the source supplied it. The text identifies the entry for change comparison, because the
 * layer builds new copies on every snapshot.
 *
 * @internal
 */
export interface LayerEntry {
  item: LDFeatureStoreItem;
  json: string;
}

/**
 * The entries of one kind, keyed by item key.
 *
 * @internal
 */
export type LayerKindContents = Record<string, LayerEntry>;

/**
 * The entries of the layer, keyed by namespace and then by item key.
 *
 * @internal
 */
export type LayerContents = Record<string, LayerKindContents>;

/**
 * Copies a definition the source supplied, prepares the copy for evaluation the way the SDK
 * prepares LaunchDarkly data, and marks it. The source's object is never modified.
 */
function prepareFlag(item: LDKeyedFeatureStoreItem): LayerEntry {
  const json = JSON.stringify(item);
  const flag = JSON.parse(json) as Flag;
  processFlag(flag);
  markOverrideEntry(flag);
  return { item: flag, json };
}

function prepareSegment(item: LDKeyedFeatureStoreItem): LayerEntry {
  const json = JSON.stringify(item);
  const segment = JSON.parse(json) as Segment;
  processSegment(segment);
  markOverrideEntry(segment);
  return { item: segment, json };
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
    return this._contents[kind.namespace]?.[key]?.item;
  }

  /**
   * Returns the entries of the given kind, keyed by item key.
   */
  all(kind: DataKind): LDFeatureStoreKindData {
    const result: LDFeatureStoreKindData = {};
    Object.entries(this._contents[kind.namespace] ?? {}).forEach(([key, entry]) => {
      result[key] = entry.item;
    });
    return result;
  }

  /**
   * Reports whether the layer holds no entries. A configured but unpopulated layer costs one
   * check per read.
   */
  isEmpty(): boolean {
    return this._empty;
  }
}
