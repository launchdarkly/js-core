import { Flag } from '../../src/evaluation/data/Flag';
import { fileOverrideSourcePolicy } from '../../src/overrides';

// The policy is the one place where the file-based override source differs from the file data
// sources in how documents become data.

it('expands a flag value into a flag that is on and serves the value by fallthrough with version 1', () => {
  const policy = fileOverrideSourcePolicy('fail');
  expect(policy.makeFlagWithValue('flag', 'a', undefined)).toEqual({
    key: 'flag',
    version: 1,
    on: true,
    fallthrough: { variation: 0 },
    variations: ['a'],
  });
  // The previous flag plays no part: an override snapshot has no version history.
  const previous = { ...policy.makeFlagWithValue('flag', 'old', undefined), version: 9 };
  expect(policy.makeFlagWithValue('flag', 'a', previous).version).toBe(1);
});

it('fails the load on a duplicate key with the fail handling', () => {
  const policy = fileOverrideSourcePolicy('fail');
  expect(() => policy.resolveDuplicateKey('flag', 'flag1')).toThrow(
    "flag 'flag1' is specified by multiple files",
  );
  expect(() => policy.resolveDuplicateKey('segment', 'seg1')).toThrow(
    "segment 'seg1' is specified by multiple files",
  );
});

it('keeps the first entry on a duplicate key with the ignore handling', () => {
  const policy = fileOverrideSourcePolicy('ignore');
  expect(policy.resolveDuplicateKey('flag', 'flag1')).toEqual('keepFirst');
  expect(policy.resolveDuplicateKey('segment', 'seg1')).toEqual('keepFirst');
});

it('treats a configured file that does not exist as a file with no content', () => {
  expect(fileOverrideSourcePolicy('fail').missingFile).toEqual('skip');
});

it('parses by file extension and validates the document', () => {
  const yamlParser = jest.fn(() => ({ flagValues: { flag: 'yaml' } }));
  const policy = fileOverrideSourcePolicy('fail', yamlParser);

  expect(policy.parseDocument('data.yaml', 'flagValues:\n  flag: yaml\n')).toEqual({
    flagValues: { flag: 'yaml' },
  });
  expect(yamlParser).toHaveBeenCalledTimes(1);
  // A file without a YAML extension is JSON, whatever its content looks like.
  expect(() => policy.parseDocument('data.json', 'flagValues:\n  flag: yaml\n')).toThrow(
    SyntaxError,
  );
  expect(() => policy.parseDocument('data.json', '{"flags": []}')).toThrow(
    '"flags" must be an object keyed by flag key',
  );
  expect(policy.parseDocument('data.json', '{"flags": {"a": {"version": 1}}}')).toEqual({
    flags: { a: { key: 'a', version: 1 } },
  });
});

it('keys a flag or segment entry by its map key', () => {
  const policy = fileOverrideSourcePolicy('fail');
  expect(policy.entryKey('map-key', { key: 'own-key' } as Flag)).toEqual('map-key');
});
