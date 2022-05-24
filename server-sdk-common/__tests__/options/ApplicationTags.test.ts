import ApplicationTags from '../../src/options/ApplicationTags';
import { ValidatedOptions } from '../../src/options/ValidatedOptions';

describe.each([
  [{application: {id: 'is-valid', version: 'also-valid'}}, "application-id/is-valid application-version/also-valid"],
  [{application: {id: 'is-valid'}}, "application-id/is-valid"],
  [{application: {version: 'also-valid'}}, "application-version/also-valid"],
  [{application: {}}, undefined],
  [{}, undefined],
  [undefined, undefined]
])('given application tags configurations', (config, result) => {
  it('produces the correct tag values', () => {
    const tags = new ApplicationTags(config as unknown as ValidatedOptions);
    expect(tags.value).toEqual(result);
  });
});