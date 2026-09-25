import {
  FileDataReadError,
  isFileNotFoundError,
  isYamlPath,
  parseDocument,
} from '../../../src/data_sources/filedata';

const flag1 = {
  key: 'flag1',
  on: true,
  fallthrough: { variation: 0 },
  variations: [true],
  version: 2,
};
const segment1 = { key: 'segment1', included: ['user1'], version: 3 };

it('parses a JSON document with flags, flag values, and segments', () => {
  const document = parseDocument(
    'data.json',
    JSON.stringify({ flags: { flag1 }, flagValues: { flag2: 'value' }, segments: { segment1 } }),
  );
  expect(document.flags).toEqual({ flag1 });
  expect(document.flagValues).toEqual({ flag2: 'value' });
  expect(document.segments).toEqual({ segment1 });
});

it('parses a JSON document that only has some members', () => {
  const document = parseDocument('data.json', JSON.stringify({ flagValues: { flag2: 'value' } }));
  expect(document.flags).toBeUndefined();
  expect(document.flagValues).toEqual({ flag2: 'value' });
  expect(document.segments).toBeUndefined();
});

it('treats an empty document as a document with no members', () => {
  const document = parseDocument('data.json', '{}');
  expect(document).toEqual({});
});

it.each(['data.yml', 'data.yaml'])(
  'parses a file with a YAML extension using the parser: %s',
  (path) => {
    const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
    const document = parseDocument(path, 'flagValues:\n  flag1: true\n', yamlParser);
    expect(yamlParser).toHaveBeenCalledWith('flagValues:\n  flag1: true\n');
    expect(document.flagValues).toEqual({ flag1: true });
  },
);

it('detects YAML from the content when the extension is not a YAML extension', () => {
  const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
  const document = parseDocument('data.json', 'flagValues:\n  flag1: true\n', yamlParser);
  expect(yamlParser).toHaveBeenCalledTimes(1);
  expect(document.flagValues).toEqual({ flag1: true });
});

it('parses JSON content as JSON without consulting the YAML parser', () => {
  const yamlParser = jest.fn();
  const document = parseDocument('data.txt', '  \n{"flagValues": {"flag1": true}}', yamlParser);
  expect(yamlParser).not.toHaveBeenCalled();
  expect(document.flagValues).toEqual({ flag1: true });
});

it('always parses a file with a YAML extension as YAML, even when the content looks like JSON', () => {
  const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
  parseDocument('data.yaml', '{"flagValues": {"flag1": true}}', yamlParser);
  expect(yamlParser).toHaveBeenCalledTimes(1);
});

it('reports a YAML file when no parser is available', () => {
  expect(() => parseDocument('data.yml', '')).toThrow(
    'Attempted to parse yaml file (data.yml) without parser.',
  );
  expect(() => parseDocument('data.json', 'flagValues:\n  flag1: true\n')).toThrow(
    'Attempted to parse yaml file (data.json) without parser.',
  );
});

it('treats a parser result of null or undefined as an empty document', () => {
  expect(parseDocument('empty.yaml', '', () => null)).toEqual({});
  expect(parseDocument('empty.yaml', '', () => undefined)).toEqual({});
});

it('rejects malformed JSON', () => {
  expect(() => parseDocument('data.json', '{"flagValues"')).toThrow(/json/i);
});

it('rejects a document that is not an object', () => {
  expect(() => parseDocument('data.yaml', '- a\n', () => ['a'])).toThrow(
    'file data must be an object',
  );
  expect(() => parseDocument('data.yaml', 'text', () => 'text')).toThrow(
    'file data must be an object',
  );
});

it('rejects members that are not objects keyed by item key', () => {
  expect(() => parseDocument('data.json', '{"flags": []}')).toThrow(
    '"flags" must be an object keyed by flag key',
  );
  expect(() => parseDocument('data.json', '{"segments": "x"}')).toThrow(
    '"segments" must be an object keyed by segment key',
  );
  expect(() => parseDocument('data.json', '{"flagValues": [1]}')).toThrow(
    '"flagValues" must be an object keyed by flag key',
  );
});

it('rejects a flag or segment entry that is not an object', () => {
  expect(() => parseDocument('data.json', '{"flags": {"flag1": "x"}}')).toThrow(
    'flag "flag1" must be an object',
  );
  expect(() => parseDocument('data.json', '{"segments": {"segment1": 7}}')).toThrow(
    'segment "segment1" must be an object',
  );
});

it('fills a missing entry key from the map key and keeps an existing key', () => {
  const document = parseDocument(
    'data.json',
    JSON.stringify({
      flags: { 'flag-a': { on: false, version: 1 }, 'flag-b': { key: 'other', version: 1 } },
      segments: { 'segment-a': { version: 1 } },
    }),
  );
  expect(document.flags?.['flag-a'].key).toEqual('flag-a');
  expect(document.flags?.['flag-b'].key).toEqual('other');
  expect(document.segments?.['segment-a'].key).toEqual('segment-a');
});

it('recognizes YAML paths', () => {
  expect(isYamlPath('a.yml')).toBe(true);
  expect(isYamlPath('a.yaml')).toBe(true);
  expect(isYamlPath('a.json')).toBe(false);
  expect(isYamlPath('a.yaml.json')).toBe(false);
});

it('recognizes a file not found error by its code', () => {
  const err = new Error('missing') as Error & { code: string };
  err.code = 'ENOENT';
  expect(isFileNotFoundError(err)).toBe(true);
  expect(isFileNotFoundError(new Error('other'))).toBe(false);
  expect(isFileNotFoundError(undefined)).toBe(false);
  expect(isFileNotFoundError({ code: 'EACCES' })).toBe(false);
});

it('includes the path in a file data read error', () => {
  const err = new FileDataReadError('error parsing file: bad', '/tmp/data.json');
  expect(err.path).toEqual('/tmp/data.json');
  expect(err.message).toEqual('error parsing file: bad [/tmp/data.json]');
  expect(err).toBeInstanceOf(Error);
});
