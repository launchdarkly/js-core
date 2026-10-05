import { FileDataDocument, mergeDocuments } from '../../src/data_sources/filedata';
import { fileDataInitializerPolicy } from '../../src/data_sources/fileDataInitilizerFDv2';
import { fileDataSourcePolicy } from '../../src/data_sources/FileDataSource';
import { Flag } from '../../src/evaluation/data/Flag';

// The policies are the one place where the file data source and the FDv2 file data
// initializer differ from the other file-based sources in how documents become data.

const onFlag = (key: string, value: any, version: number): Flag => ({
  key,
  on: true,
  fallthrough: { variation: 0 },
  variations: [value],
  version,
});

describe('given the file data source policy', () => {
  const policy = fileDataSourcePolicy();

  it('expands a flag value into a flag that is on and serves the value by fallthrough', () => {
    expect(policy.makeFlagWithValue('flag', 'a', undefined)).toEqual(onFlag('flag', 'a', 1));
  });

  it('keeps the version of the previous flag when the value is unchanged', () => {
    expect(policy.makeFlagWithValue('flag', 'a', onFlag('flag', 'a', 3))).toEqual(
      onFlag('flag', 'a', 3),
    );
  });

  it('increments the version when the value changes', () => {
    expect(policy.makeFlagWithValue('flag', 'b', onFlag('flag', 'a', 3))).toEqual(
      onFlag('flag', 'b', 4),
    );
    expect(policy.makeFlagWithValue('flag', { x: 1 }, onFlag('flag', { x: 2 }, 1)).version).toBe(2);
    expect(policy.makeFlagWithValue('flag', { x: 1 }, onFlag('flag', { x: 1 }, 1)).version).toBe(1);
  });

  it('carries the version forward from a previous full flag definition', () => {
    const previous: Flag = {
      key: 'flag',
      on: false,
      fallthrough: { variation: 0 },
      variations: ['a', 'b'],
      version: 7,
    };
    expect(policy.makeFlagWithValue('flag', 'a', previous).version).toBe(7);
    expect(policy.makeFlagWithValue('flag', 'z', previous).version).toBe(8);
  });

  it('fails the load on a duplicate key with the existing message', () => {
    expect(() => policy.resolveDuplicateKey('flag', 'flag1')).toThrow(
      'found duplicate key: "flag1"',
    );
    expect(() => policy.resolveDuplicateKey('segment', 'seg1')).toThrow(
      'found duplicate key: "seg1"',
    );
  });

  it('treats a missing file as a failed load', () => {
    expect(policy.missingFile).toEqual('fail');
  });

  it('parses by extension and passes the YAML parser through', () => {
    const yamlParser = jest.fn(() => ({ flagValues: { flag: 'yaml' } }));
    const withParser = fileDataSourcePolicy(yamlParser);
    expect(withParser.parseDocument('data.yaml', 'x')).toEqual({ flagValues: { flag: 'yaml' } });
    expect(withParser.parseDocument('data.json', '{"flagValues": {"flag": "json"}}')).toEqual({
      flagValues: { flag: 'json' },
    });
    expect(yamlParser).toHaveBeenCalledTimes(1);
  });
});

describe('given the file data initializer policy', () => {
  const policy = fileDataInitializerPolicy();

  it('expands a flag value into an on flag with version 1 regardless of the previous flag', () => {
    expect(policy.makeFlagWithValue('flag', 'a', undefined)).toEqual(onFlag('flag', 'a', 1));
    expect(policy.makeFlagWithValue('flag', 'b', onFlag('flag', 'a', 3))).toEqual(
      onFlag('flag', 'b', 1),
    );
  });

  it('keeps the last definition of a duplicate key', () => {
    expect(policy.resolveDuplicateKey('flag', 'flag1')).toEqual('keepLast');
    expect(policy.resolveDuplicateKey('segment', 'seg1')).toEqual('keepLast');
  });

  it('treats a missing file as a failed load', () => {
    expect(policy.missingFile).toEqual('fail');
  });
});

describe('given the entry keys of the two policies', () => {
  it('the file data source keys an entry by its own key property, as it has always stored it', () => {
    const policy = fileDataSourcePolicy();
    expect(policy.entryKey('map-key', { key: 'own-key' } as Flag)).toEqual('own-key');
    expect(policy.entryKey('map-key', {} as Flag)).toEqual('undefined');
  });

  it('the file data source detects a duplicate by the key property across map keys', () => {
    const documents: FileDataDocument[] = [
      { flags: { a: { key: 'x', version: 1 } as Flag } },
      { flags: { b: { key: 'x', version: 1 } as Flag } },
    ];
    expect(() => mergeDocuments(fileDataSourcePolicy(), documents)).toThrow(
      'found duplicate key: "x"',
    );
  });

  it('the initializer keys an entry by its map key, as it has always merged it', () => {
    const policy = fileDataInitializerPolicy();
    expect(policy.entryKey('map-key', { key: 'own-key' } as Flag)).toEqual('map-key');
  });
});
