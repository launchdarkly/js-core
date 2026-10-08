import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';
import { FileDataDocument } from './document';
import { FileDataPolicy, ItemCategory } from './FileDataPolicy';

/**
 * One merged item with the key it was listed under in its document.
 *
 * @internal
 */
export interface KeyedItem<T> {
  key: string;
  item: T;
}

/**
 * Counts the entries the merge kept from one document. An entry that the duplicate key
 * resolution dropped, or that a later document replaced, is not counted.
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
   * False when the file does not exist and missing files contribute nothing.
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
  flags: KeyedItem<Flag>[];
  segments: KeyedItem<Segment>[];
  /**
   * One summary for each input document, in order.
   */
  documents: DocumentSummary[];
}

/**
 * Combines the items of the given documents in order. `flags` and `segments` entries are keyed
 * by the policy's `entryKey`, and `flagValues` entries are expanded by the policy and keyed by
 * their map key. The policy decides what happens when a key appears more than once: keep the
 * first entry, keep the last entry, or fail the load. Members that are not objects contribute
 * no entries.
 *
 * @param policy The source's translation policy.
 * @param documents The parsed documents, in the configured order.
 * @param previousFlags The flags the last successful load produced, keyed by flag key. The
 * policy can use them to carry versions forward.
 *
 * @internal
 */
export function mergeDocuments(
  policy: FileDataPolicy,
  documents: FileDataDocument[],
  previousFlags: Record<string, Flag> = {},
): MergeResult {
  const flags: KeyedItem<Flag>[] = [];
  const segments: KeyedItem<Segment>[] = [];
  const summaries: DocumentSummary[] = documents.map(() => ({ flags: 0, segments: 0 }));
  // For each kept key: its position in the items array and the document it came from.
  const positions: Record<ItemCategory, Map<string, { index: number; document: number }>> = {
    flag: new Map(),
    segment: new Map(),
  };

  const insert = <T>(
    items: KeyedItem<T>[],
    category: ItemCategory,
    key: string,
    item: T,
    documentIndex: number,
  ): void => {
    const counter = category === 'flag' ? 'flags' : 'segments';
    const existing = positions[category].get(key);
    if (existing) {
      if (policy.resolveDuplicateKey(category, key) === 'keepFirst') {
        return;
      }
      // The later entry replaces the earlier one in place, so the earlier document's count
      // moves to the later document.
      items[existing.index] = { key, item };
      summaries[existing.document][counter] -= 1;
      summaries[documentIndex][counter] += 1;
      positions[category].set(key, { index: existing.index, document: documentIndex });
      return;
    }
    items.push({ key, item });
    positions[category].set(key, { index: items.length - 1, document: documentIndex });
    summaries[documentIndex][counter] += 1;
  };

  documents.forEach((document, documentIndex) => {
    Object.entries(document.flags ?? {}).forEach(([key, flag]) => {
      insert(flags, 'flag', policy.entryKey(key, flag), flag, documentIndex);
    });
    Object.entries(document.flagValues ?? {}).forEach(([key, value]) => {
      insert(
        flags,
        'flag',
        key,
        policy.makeFlagWithValue(key, value, previousFlags[key]),
        documentIndex,
      );
    });
    Object.entries(document.segments ?? {}).forEach(([key, segment]) => {
      insert(segments, 'segment', policy.entryKey(key, segment), segment, documentIndex);
    });
  });

  return { flags, segments, documents: summaries };
}
