import ApplicationTags from '../../src/options/ApplicationTags';
import { ValidatedOptions } from '../../src/options/ValidatedOptions';
import TestLogger, { LogLevel } from '../Logger';

describe.each([
  [
    { application: { id: 'is-valid', version: 'also-valid' }, logger: new TestLogger() },
    'application-id/is-valid application-version/also-valid', [],
  ],
  [{ application: { id: 'is-valid' }, logger: new TestLogger() }, 'application-id/is-valid', []],
  [{ application: { version: 'also-valid' }, logger: new TestLogger() }, 'application-version/also-valid', []],
  [{ application: {}, logger: new TestLogger() }, undefined, []],
  [{ logger: new TestLogger() }, undefined, []],
  [undefined, undefined, undefined],

  // Above ones are 'valid' cases. Below are invalid.
  [
    { application: { id: 'bad tag' }, logger: new TestLogger() },
    undefined, [
      { level: LogLevel.Warn, matches: /Config option "application.id" must/ },
    ],
  ],
  [
    { application: { id: 'bad tag', version: 'good-tag' }, logger: new TestLogger() },
    'application-version/good-tag', [
      { level: LogLevel.Warn, matches: /Config option "application.id" must/ },
    ],
  ],
  [
    { application: { id: 'bad tag', version: 'also bad' }, logger: new TestLogger() },
    undefined, [
      { level: LogLevel.Warn, matches: /Config option "application.id" must/ },
      { level: LogLevel.Warn, matches: /Config option "application.version" must/ },
    ],
  ],
  // Bad tags and no logger.
  [
    { application: { id: 'bad tag', version: 'also bad' }, logger: undefined },
    undefined, undefined,
  ],
])('given application tags configurations', (config, result, logs) => {
  it('produces the correct tag values', () => {
    const tags = new ApplicationTags(config as unknown as ValidatedOptions);
    expect(tags.value).toEqual(result);
  });

  it('logs issues it encounters', () => {
    expect(config?.logger?.getCount()).toEqual(logs?.length);
    if (logs) {
      config?.logger?.verifyMessages(logs).forEach((message) => expect(message).toBeUndefined());
    }
  });
});
