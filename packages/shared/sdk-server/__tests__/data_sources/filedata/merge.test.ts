import { mergeDocuments } from '../../../src/data_sources/filedata';
import { Flag } from '../../../src/evaluation/data/Flag';
import { Segment } from '../../../src/evaluation/data/Segment';
import testPolicy from './testPolicy';

function flag(key: string, version: number): Flag {
  return { key, version, on: false, fallthrough: { variation: 0 }, variations: [true] };
}

function segment(key: string, version: number): Segment {
  return { key, version };
}

const keysOf = (items: { key: string }[]) => items.map((item) => item.key);

it('combines the items of several documents in order', () => {
  const result = mergeDocuments(testPolicy(), [
    { flags: { flag1: flag('flag1', 2) } },
    { flagValues: { flag2: true } },
    { segments: { segment1: segment('segment1', 4) } },
  ]);

  expect(keysOf(result.flags)).toEqual(['flag1', 'flag2']);
  expect(result.flags[0].item.version).toEqual(2);
  expect(result.flags[1].item).toEqual(testPolicy().makeFlagWithValue('flag2', true, undefined));
  expect(keysOf(result.segments)).toEqual(['segment1']);
  expect(result.segments[0].item.version).toEqual(4);
  expect(result.documents).toEqual([
    { flags: 1, segments: 0 },
    { flags: 1, segments: 0 },
    { flags: 0, segments: 1 },
  ]);
});

it('expands flag values with the policy and hands it the previous flag for the key', () => {
  const makeFlagWithValue = jest.fn((key: string, value: any, previous?: Flag) =>
    flag(key, (previous?.version ?? 0) + 1),
  );
  const previous = { flag1: flag('flag1', 5) };

  const result = mergeDocuments(
    testPolicy({ makeFlagWithValue }),
    [{ flagValues: { flag1: 'a', flag2: 'b' } }],
    previous,
  );

  expect(makeFlagWithValue).toHaveBeenCalledWith('flag1', 'a', previous.flag1);
  expect(makeFlagWithValue).toHaveBeenCalledWith('flag2', 'b', undefined);
  expect(result.flags.map((item) => item.item.version)).toEqual([6, 1]);
});

it('fails the merge when the policy throws for a duplicate key', () => {
  expect(() =>
    mergeDocuments(testPolicy(), [
      { flags: { flag1: flag('flag1', 1) } },
      { flags: { flag1: flag('flag1', 2) } },
    ]),
  ).toThrow('duplicate flag flag1');
});

it('keeps the first entry when the policy resolves a duplicate key to keepFirst', () => {
  const result = mergeDocuments(testPolicy({ resolveDuplicateKey: () => 'keepFirst' }), [
    { flags: { flag1: flag('flag1', 1) } },
    { flags: { flag1: flag('flag1', 2) } },
  ]);
  expect(result.flags).toHaveLength(1);
  expect(result.flags[0].item.version).toEqual(1);
  expect(result.documents).toEqual([
    { flags: 1, segments: 0 },
    { flags: 0, segments: 0 },
  ]);
});

it('keeps the last entry in the first position when the policy resolves to keepLast', () => {
  const result = mergeDocuments(testPolicy({ resolveDuplicateKey: () => 'keepLast' }), [
    { flags: { flag1: flag('flag1', 1), other: flag('other', 1) } },
    { flags: { flag1: flag('flag1', 2) } },
  ]);
  expect(keysOf(result.flags)).toEqual(['flag1', 'other']);
  expect(result.flags[0].item.version).toEqual(2);
  // The kept entry counts for the document it came from.
  expect(result.documents).toEqual([
    { flags: 1, segments: 0 },
    { flags: 1, segments: 0 },
  ]);
});

it('treats a full flag and a flag value with the same key as duplicates', () => {
  const resolveDuplicateKey = jest.fn(() => 'keepLast' as const);
  const result = mergeDocuments(testPolicy({ resolveDuplicateKey }), [
    { flags: { flag1: flag('flag1', 1) }, flagValues: { flag1: true } },
  ]);
  expect(resolveDuplicateKey).toHaveBeenCalledWith('flag', 'flag1');
  expect(result.flags).toHaveLength(1);
  expect(result.flags[0].item.variations).toEqual([true]);
});

it('resolves duplicate segment keys through the policy', () => {
  const resolveDuplicateKey = jest.fn(() => 'keepFirst' as const);
  mergeDocuments(testPolicy({ resolveDuplicateKey }), [
    { segments: { segment1: segment('segment1', 1) } },
    { segments: { segment1: segment('segment1', 2) } },
  ]);
  expect(resolveDuplicateKey).toHaveBeenCalledWith('segment', 'segment1');
});

it('does not treat a flag and a segment with the same key as duplicates', () => {
  const result = mergeDocuments(testPolicy(), [
    { flags: { same: flag('same', 1) }, segments: { same: segment('same', 1) } },
  ]);
  expect(result.flags).toHaveLength(1);
  expect(result.segments).toHaveLength(1);
});

it('preserves document order', () => {
  const keys = ['flag-a', 'flag-b', 'flag-c', 'flag-d', 'flag-e'];
  const result = mergeDocuments(
    testPolicy(),
    keys.map((key) => ({ flags: { [key]: flag(key, 1) } })),
  );
  expect(keysOf(result.flags)).toEqual(keys);
});

it('keeps the key an entry was listed under, separate from the entry', () => {
  const result = mergeDocuments(testPolicy(), [
    { flags: { 'map-key': { version: 1 } as unknown as Flag } },
  ]);
  expect(result.flags[0].key).toEqual('map-key');
  expect(result.flags[0].item).toEqual({ version: 1 });
});

it('contributes nothing for members that are not objects', () => {
  const result = mergeDocuments(testPolicy(), [
    { flags: [] as unknown as Record<string, Flag>, flagValues: null as any, segments: 0 as any },
  ]);
  expect(result).toEqual({ flags: [], segments: [], documents: [{ flags: 0, segments: 0 }] });
});

it('produces an empty result for no documents', () => {
  expect(mergeDocuments(testPolicy(), [])).toEqual({ flags: [], segments: [], documents: [] });
});
