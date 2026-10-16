import { FileDataPolicy, parseDocumentByExtension } from '../../../src/data_sources/filedata';
import { Flag } from '../../../src/evaluation/data/Flag';

/**
 * A policy for the engine tests: content-based parsing, a flag value expands into an off flag
 * with version 1, a duplicate key fails the load, and a missing file contributes nothing. Tests
 * override the parts they exercise.
 */
export default function testPolicy(overrides: Partial<FileDataPolicy> = {}): FileDataPolicy {
  return {
    parseDocument: parseDocumentByExtension(),
    entryKey: (mapKey) => mapKey,
    makeFlagWithValue: (key: string, value: any): Flag => ({
      key,
      version: 1,
      on: false,
      offVariation: 0,
      fallthrough: { variation: 0 },
      variations: [value],
    }),
    resolveDuplicateKey: (category, key) => {
      throw new Error(`duplicate ${category} ${key}`);
    },
    missingFile: 'skip',
    ...overrides,
  };
}
