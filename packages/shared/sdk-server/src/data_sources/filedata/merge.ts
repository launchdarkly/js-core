import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';
import { FileDataDocument } from './document';

/**
 * What happens when the same flag or segment key appears in more than one document.
 *
 * - `fail`: the merge fails.
 * - `ignore`: only the first occurrence is used, in the order the documents were given.
 *
 * @internal
 */
export type DuplicateKeysHandling = 'fail' | 'ignore';

/**
 * Counts the entries the merge kept from one document. An entry dropped by the duplicate
 * keys handling is not counted.
 *
 * @internal
 */
export interface DocumentSummary {
  flags: number;
  segments: number;
}

/**
 * Describes one configured file after a reload.
 *
 * @internal
 */
export interface FileSummary {
  path: string;
  /**
   * False when the file does not exist and missing files are skipped.
   */
  present: boolean;
  flags: number;
  segments: number;
}

/**
 * The merged items from one or more documents.
 *
 * Ordering is deterministic at document granularity only. All of one document's items precede
 * the next document's items, in the order the documents were given. The order of the items
 * within one document is unspecified. Consumers key items by their `key`.
 *
 * @internal
 */
export interface MergeResult {
  flags: Flag[];
  segments: Segment[];
  /**
   * One summary for each input document, in order.
   */
  documents: DocumentSummary[];
}

/**
 * Expands a flag key to value entry into a full flag definition that returns the given value
 * for every context. The flag is off and serves its single variation as the off variation.
 *
 * @internal
 */
export function expandFlagValue(key: string, value: any): Flag {
  return {
    key,
    version: 1,
    on: false,
    offVariation: 0,
    fallthrough: { variation: 0 },
    variations: [value],
  };
}

type ItemCategory = 'flag' | 'segment';

/**
 * Combines the items of the given documents in order. Flag value entries are expanded into
 * full flag definitions. The duplicate keys handling decides what happens when a key appears
 * more than once. An unrecognized handling value behaves as `fail`.
 *
 * @internal
 */
export function mergeDocuments(
  duplicateKeysHandling: DuplicateKeysHandling,
  documents: FileDataDocument[],
): MergeResult {
  const flags: Flag[] = [];
  const segments: Segment[] = [];
  const seenKeys: Record<ItemCategory, Set<string>> = {
    flag: new Set<string>(),
    segment: new Set<string>(),
  };

  // Adds the entry unless the key was already seen. Reports whether it added it.
  const insert = <T extends { key: string }>(
    items: T[],
    category: ItemCategory,
    key: string,
    item: T,
  ): boolean => {
    if (seenKeys[category].has(key)) {
      if (duplicateKeysHandling === 'ignore') {
        return false;
      }
      throw new Error(`${category} '${key}' is specified by multiple files`);
    }
    items.push(item);
    seenKeys[category].add(key);
    return true;
  };

  const summaries = documents.map((document) => {
    const summary: DocumentSummary = { flags: 0, segments: 0 };
    Object.entries(document.flags ?? {}).forEach(([key, flag]) => {
      if (insert(flags, 'flag', key, flag)) {
        summary.flags += 1;
      }
    });
    Object.entries(document.flagValues ?? {}).forEach(([key, value]) => {
      if (insert(flags, 'flag', key, expandFlagValue(key, value))) {
        summary.flags += 1;
      }
    });
    Object.entries(document.segments ?? {}).forEach(([key, segment]) => {
      if (insert(segments, 'segment', key, segment)) {
        summary.segments += 1;
      }
    });
    return summary;
  });

  return { flags, segments, documents: summaries };
}
