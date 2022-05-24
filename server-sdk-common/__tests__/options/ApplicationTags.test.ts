import ApplicationTags from '../../src/options/ApplicationTags';
import { ValidatedOptions } from '../../src/options/ValidatedOptions';
import TestLogger from '../Logger';

describe.each([
  [
    { application: { id: 'is-valid', version: 'also-valid' }, logger: new TestLogger() },
    'application-id/is-valid application-version/also-valid', 0,
  ],
  [{ application: { id: 'is-valid' }, logger: new TestLogger() }, 'application-id/is-valid', 0],
  [{ application: { version: 'also-valid' }, logger: new TestLogger() }, 'application-version/also-valid', 0],
  [{ application: {}, logger: new TestLogger() }, undefined, 0],
  [{ logger: new TestLogger() }, undefined, 0],
  [undefined, undefined, undefined],

  // Above ones are 'valid' cases. Below are invalid.
  [
    { application: { id: 'bad tag' }, logger: new TestLogger() },
    undefined, 1,
  ],
  [
    { application: { id: 'bad tag', version: 'good-tag' }, logger: new TestLogger() },
    'application-version/good-tag', 1,
  ],
  [
    { application: { id: 'bad tag', version: 'also bad' }, logger: new TestLogger() },
    undefined, 2,
  ],
  // Bad tags and no logger.
  [
    { application: { id: 'bad tag', version: 'also bad' }, logger: undefined },
    undefined, undefined,
  ],
])('given application tags configurations', (config, result, logCount) => {
  it('produces the correct tag values', () => {
    const tags = new ApplicationTags(config as unknown as ValidatedOptions);
    expect(tags.value).toEqual(result);
  });

  it('logs issues it encounters', () => {
    expect(config?.logger?.warningMessages.length).toEqual(logCount);
  });
});
