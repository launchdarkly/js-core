import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';
import { FileDataDocument } from './document';

/**
 * The kind of item a key identifies.
 *
 * @internal
 */
export type ItemCategory = 'flag' | 'segment';

/**
 * Which entry to keep when a key appears more than once.
 *
 * @internal
 */
export type DuplicateKeyResolution = 'keepFirst' | 'keepLast';

/**
 * What a configured file that does not exist means.
 *
 * - `fail`: the load fails and is reported like any other read failure.
 * - `skip`: the file contributes no data and the load succeeds with the other files.
 *
 * @internal
 */
export type MissingFileHandling = 'fail' | 'skip';

/**
 * How a source translates file documents into flag and segment data.
 *
 * The shared file data engine reads, reloads, and merges files the same way for every source.
 * Each source supplies one policy that decides how its documents become data, so the differences
 * between sources are visible in one place per source.
 *
 * @internal
 */
export interface FileDataPolicy {
  /**
   * Parses the text of one file into a document. Throws when the file cannot be parsed.
   */
  parseDocument(path: string, data: string): FileDataDocument;

  /**
   * Expands a `flagValues` entry into a full flag definition. `previous` is the flag that the last
   * successful load produced for the same key, if any, so that a policy can carry a version
   * forward.
   */
  makeFlagWithValue(key: string, value: any, previous: Flag | undefined): Flag;

  /**
   * Decides what happens when a key appears more than once: across the configured files, or
   * between the `flags` and `flagValues` members of one file. Returns which entry to keep, or
   * throws to fail the load.
   */
  resolveDuplicateKey(category: ItemCategory, key: string): DuplicateKeyResolution;

  /**
   * What a configured file that does not exist means.
   */
  missingFile: MissingFileHandling;

  /**
   * Returns the key under which a `flags` or `segments` entry is stored and checked for
   * duplicates. `mapKey` is the property name of the entry in the document, and `entry` is its
   * definition. The file data source keys an entry by its own `key` property, the FDv2
   * initializer and the override source by the map key.
   */
  entryKey(mapKey: string, entry: Flag | Segment): string;
}
