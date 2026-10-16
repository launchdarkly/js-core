import {
  isFileNotFoundError,
  isYamlPath,
  parseDocumentByExtension,
} from '../../../src/data_sources/filedata';

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

describe('given the extension-based parser', () => {
  it('parses a file without a YAML extension as JSON and does not consult the YAML parser', () => {
    const yamlParser = jest.fn();
    const document = parseDocumentByExtension(yamlParser)('data.txt', jsonDocument);
    expect(document.flags).toEqual({ flag1 });
    expect(document.flagValues).toEqual({ flag2: 'value' });
    expect(document.segments).toEqual({ segment1 });
    expect(yamlParser).not.toHaveBeenCalled();
  });

  it('reports a JSON error for a file without a YAML extension whose content is YAML', () => {
    const yamlParser = jest.fn();
    expect(() => parseDocumentByExtension(yamlParser)('data.json', yamlDocument)).toThrow(/json/i);
    expect(yamlParser).not.toHaveBeenCalled();
  });

  it.each(['data.yml', 'data.yaml'])(
    'parses %s with the YAML parser even when the content looks like JSON',
    (path) => {
      const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
      const document = parseDocumentByExtension(yamlParser)(path, jsonDocument);
      expect(yamlParser).toHaveBeenCalledWith(jsonDocument);
      expect(document.flagValues).toEqual({ flag1: true });
    },
  );

  it.each(['data.yml', 'data.yaml'])('reports a missing YAML parser for %s', (path) => {
    expect(() => parseDocumentByExtension()(path, '')).toThrow(
      `Attempted to parse yaml file (${path}) without parser.`,
    );
  });

  it('returns the parsed value as it is, without validation', () => {
    const parse = parseDocumentByExtension();
    expect(parse('data.json', '{"flags": [], "flagValues": null, "segments": 0}')).toEqual({
      flags: [],
      flagValues: null,
      segments: 0,
    });
    expect(parse('data.json', '{"flags": {"flag-a": {"version": 1}}}')).toEqual({
      flags: { 'flag-a': { version: 1 } },
    });
    expect(parse('data.json', 'null')).toBeNull();
  });
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
