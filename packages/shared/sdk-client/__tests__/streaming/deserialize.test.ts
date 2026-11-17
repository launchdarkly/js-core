import {
  deserializeDelete,
  deserializePatch,
  deserializePut,
} from '../../src/streaming/deserialize';

describe('deserializePut', () => {
  it('returns the flags of a valid put', () => {
    const data =
      '{"flag":{"version":1,"value":true,"variation":0},"off":{"version":2,"value":null}}';

    expect(deserializePut(data)).toEqual({
      flag: { version: 1, value: true, variation: 0 },
      off: { version: 2, value: null },
    });
  });

  it.each([
    ['malformed JSON', '{sorry'],
    ['a value that is not an object', '[]'],
    ['a flag that is not an object', '{"flag":true}'],
    ['a flag that is null', '{"flag":null}'],
    ['a flag without a version', '{"flag":{"value":true}}'],
    ['a flag whose version is not a number', '{"flag":{"version":"no","value":true}}'],
  ])('rejects %s', (_name, data) => {
    expect(deserializePut(data)).toBeUndefined();
  });
});

describe('deserializePatch', () => {
  it('returns the flag of a valid patch', () => {
    const data = '{"key":"flag","version":2,"value":"x","variation":1}';

    expect(deserializePatch(data)).toEqual({ key: 'flag', version: 2, value: 'x', variation: 1 });
  });

  it.each([
    ['malformed JSON', '{sorry'],
    ['a patch without a key', '{"version":2,"value":"x"}'],
    ['a patch whose version is not a number', '{"key":"flag","version":"no","value":"x"}'],
    ['a patch that is not an object', '"flag"'],
  ])('rejects %s', (_name, data) => {
    expect(deserializePatch(data)).toBeUndefined();
  });
});

describe('deserializeDelete', () => {
  it('returns the key and version of a valid delete', () => {
    expect(deserializeDelete('{"key":"flag","version":3}')).toEqual({ key: 'flag', version: 3 });
  });

  it.each([
    ['malformed JSON', '{sorry'],
    ['a delete without a key', '{"version":3}'],
    ['a delete whose version is not a number', '{"key":"flag","version":"no"}'],
    ['a delete that is null', 'null'],
  ])('rejects %s', (_name, data) => {
    expect(deserializeDelete(data)).toBeUndefined();
  });
});
