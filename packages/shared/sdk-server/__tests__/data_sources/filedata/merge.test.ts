import { expandFlagValue, mergeDocuments } from '../../../src/data_sources/filedata';
import { Flag } from '../../../src/evaluation/data/Flag';
import { Segment } from '../../../src/evaluation/data/Segment';

function flag(key: string, version: number): Flag {
  return { key, version, on: false, fallthrough: { variation: 0 }, variations: [true] };
}

function segment(key: string, version: number): Segment {
  return { key, version };
}

it('expands a flag value into a full flag that is off and serves the value', () => {
  expect(expandFlagValue('my-flag', 'on')).toEqual({
    key: 'my-flag',
    version: 1,
    on: false,
    offVariation: 0,
    fallthrough: { variation: 0 },
    variations: ['on'],
  });
});

it('combines the items of several documents in order', () => {
  const result = mergeDocuments('fail', [
    { flags: { flag1: flag('flag1', 2) } },
    { flagValues: { flag2: true } },
    { segments: { segment1: segment('segment1', 4) } },
  ]);

  expect(result.flags.map((item) => item.key)).toEqual(['flag1', 'flag2']);
  expect(result.flags[0].version).toEqual(2);
  expect(result.flags[1]).toEqual(expandFlagValue('flag2', true));
  expect(result.segments.map((item) => item.key)).toEqual(['segment1']);
  expect(result.segments[0].version).toEqual(4);
});

it('fails on a duplicate flag key', () => {
  expect(() =>
    mergeDocuments('fail', [
      { flags: { flag1: flag('flag1', 1) } },
      { flags: { flag1: flag('flag1', 2) } },
    ]),
  ).toThrow("flag 'flag1' is specified by multiple files");
});

it('treats an unrecognized duplicate keys handling as fail', () => {
  expect(() =>
    mergeDocuments('bogus' as any, [
      { flags: { flag1: flag('flag1', 1) } },
      { flags: { flag1: flag('flag1', 2) } },
    ]),
  ).toThrow("flag 'flag1' is specified by multiple files");
});

it('keeps the first occurrence of a duplicate key with ignore handling', () => {
  const result = mergeDocuments('ignore', [
    { flags: { flag1: flag('flag1', 1) } },
    { flags: { flag1: flag('flag1', 2) } },
  ]);
  expect(result.flags).toHaveLength(1);
  expect(result.flags[0].version).toEqual(1);
});

it('treats a full flag and a flag value with the same key as duplicates', () => {
  expect(() =>
    mergeDocuments('fail', [
      { flags: { flag1: flag('flag1', 1) } },
      { flagValues: { flag1: true } },
    ]),
  ).toThrow("flag 'flag1' is specified by multiple files");
});

it('fails on a duplicate segment key', () => {
  expect(() =>
    mergeDocuments('fail', [
      { segments: { segment1: segment('segment1', 1) } },
      { segments: { segment1: segment('segment1', 1) } },
    ]),
  ).toThrow("segment 'segment1' is specified by multiple files");
});

it('does not treat a flag and a segment with the same key as duplicates', () => {
  const result = mergeDocuments('fail', [
    { flags: { same: flag('same', 1) }, segments: { same: segment('same', 1) } },
  ]);
  expect(result.flags).toHaveLength(1);
  expect(result.segments).toHaveLength(1);
});

it('preserves document order', () => {
  const keys = ['flag-a', 'flag-b', 'flag-c', 'flag-d', 'flag-e'];
  const result = mergeDocuments(
    'fail',
    keys.map((key) => ({ flags: { [key]: flag(key, 1) } })),
  );
  expect(result.flags.map((item) => item.key)).toEqual(keys);
});

it('counts the entries kept from each document', () => {
  const result = mergeDocuments('ignore', [
    { flagValues: { a: true, shared: true } },
    { flagValues: { b: true, shared: false }, segments: { seg: segment('seg', 1) } },
  ]);
  expect(result.documents).toHaveLength(2);
  expect(result.documents[0]).toEqual({ flags: 2, segments: 0 });
  // The duplicate "shared" entry from the second document is dropped and not counted.
  expect(result.documents[1]).toEqual({ flags: 1, segments: 1 });
});

it('produces an empty result for no documents', () => {
  expect(mergeDocuments('fail', [])).toEqual({ flags: [], segments: [], documents: [] });
});
