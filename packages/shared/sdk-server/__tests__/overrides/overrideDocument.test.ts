import { parseOverrideDocument } from '../../src/overrides/overrideDocument';

const flag1 = {
  key: 'flag1',
  on: true,
  fallthrough: { variation: 0 },
  variations: [true],
  version: 2,
};
const segment1 = { key: 'segment1', included: ['user1'], version: 3 };
const jsonDocument = JSON.stringify({
  flags: { flag1 },
  flagValues: { flag2: 'value' },
  segments: { segment1 },
});
const yamlDocument = 'flagValues:\n  flag1: true\n';

describe('given the override document parser', () => {
  it('parses a JSON document with flags, flag values, and segments', () => {
    const document = parseOverrideDocument()('data.json', jsonDocument);
    expect(document.flags).toEqual({ flag1 });
    expect(document.flagValues).toEqual({ flag2: 'value' });
    expect(document.segments).toEqual({ segment1 });
  });

  it('parses a JSON document that only has some members', () => {
    const document = parseOverrideDocument()(
      'data.json',
      JSON.stringify({ flagValues: { flag2: 'value' } }),
    );
    expect(document.flags).toBeUndefined();
    expect(document.flagValues).toEqual({ flag2: 'value' });
    expect(document.segments).toBeUndefined();
  });

  it('treats an empty document as a document with no members', () => {
    expect(parseOverrideDocument()('data.json', '{}')).toEqual({});
  });

  it.each(['data.yml', 'data.yaml'])(
    'parses a file with a YAML extension using the parser: %s',
    (path) => {
      const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
      const document = parseOverrideDocument(yamlParser)(path, yamlDocument);
      expect(yamlParser).toHaveBeenCalledWith(yamlDocument);
      expect(document.flagValues).toEqual({ flag1: true });
    },
  );

  it('parses a file without a YAML extension as JSON and does not consult the YAML parser', () => {
    const yamlParser = jest.fn();
    const document = parseOverrideDocument(yamlParser)(
      'data.txt',
      '  \n{"flagValues": {"flag1": true}}',
    );
    expect(yamlParser).not.toHaveBeenCalled();
    expect(document.flagValues).toEqual({ flag1: true });
  });

  it('reports a JSON error for a file without a YAML extension whose content is YAML', () => {
    const yamlParser = jest.fn();
    expect(() => parseOverrideDocument(yamlParser)('data.json', yamlDocument)).toThrow(SyntaxError);
    expect(yamlParser).not.toHaveBeenCalled();
  });

  it('always parses a file with a YAML extension as YAML, even when the content looks like JSON', () => {
    const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
    parseOverrideDocument(yamlParser)('data.yaml', '{"flagValues": {"flag1": true}}');
    expect(yamlParser).toHaveBeenCalledTimes(1);
  });

  it('reports a YAML file when no parser is available', () => {
    expect(() => parseOverrideDocument()('data.yml', '')).toThrow(
      'Attempted to parse yaml file (data.yml) without parser.',
    );
  });

  it('treats a parser result of null or undefined as an empty document', () => {
    expect(parseOverrideDocument(() => null)('empty.yaml', '')).toEqual({});
    expect(parseOverrideDocument(() => undefined)('empty.yaml', '')).toEqual({});
  });

  it('rejects malformed JSON', () => {
    expect(() => parseOverrideDocument()('data.json', '{"flagValues"')).toThrow(/json/i);
  });

  it('rejects a document that is not an object', () => {
    expect(() => parseOverrideDocument(() => ['a'])('data.yaml', '- a\n')).toThrow(
      'file data must be an object',
    );
    expect(() => parseOverrideDocument(() => 'text')('data.yaml', 'text')).toThrow(
      'file data must be an object',
    );
  });

  it('rejects members that are not objects keyed by item key', () => {
    const parse = parseOverrideDocument();
    expect(() => parse('data.json', '{"flags": []}')).toThrow(
      '"flags" must be an object keyed by flag key',
    );
    expect(() => parse('data.json', '{"segments": "x"}')).toThrow(
      '"segments" must be an object keyed by segment key',
    );
    expect(() => parse('data.json', '{"flagValues": [1]}')).toThrow(
      '"flagValues" must be an object keyed by flag key',
    );
  });

  it('rejects a flag or segment entry that is not an object', () => {
    const parse = parseOverrideDocument();
    expect(() => parse('data.json', '{"flags": {"flag1": "x"}}')).toThrow(
      'flag "flag1" must be an object',
    );
    expect(() => parse('data.json', '{"segments": {"segment1": 7}}')).toThrow(
      'segment "segment1" must be an object',
    );
  });

  it('keys every entry by its map key, whatever its key field says', () => {
    // The map key is what the merge across files orders and de-duplicates by, so a key field
    // that differs, as after pasting a definition under a new key, is set to the map key.
    const document = parseOverrideDocument()(
      'data.json',
      JSON.stringify({
        flags: {
          'flag-a': { on: false, version: 1 },
          'flag-b': { key: 'other', version: 1 },
          'flag-c': { key: null, version: 1 },
        },
        segments: { 'segment-a': { version: 1 }, 'segment-b': { key: 'other', version: 1 } },
      }),
    );
    expect(document.flags?.['flag-a'].key).toEqual('flag-a');
    expect(document.flags?.['flag-b'].key).toEqual('flag-b');
    expect(document.flags?.['flag-c'].key).toEqual('flag-c');
    expect(document.segments?.['segment-a'].key).toEqual('segment-a');
    expect(document.segments?.['segment-b'].key).toEqual('segment-b');
  });
});
