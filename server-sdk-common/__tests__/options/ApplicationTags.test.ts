import ApplicationTags from '../../src/options/ApplicationTags';
import { ValidatedOptions } from '../../src/options/ValidatedOptions';

function makeLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe.each([
  [
    { application: { id: 'is-valid', version: 'also-valid' }, logger: makeLogger() },
    'application-id/is-valid application-version/also-valid', [],
  ],
  [{ application: { id: 'is-valid' }, logger: makeLogger() }, 'application-id/is-valid', []],
  [{ application: { version: 'also-valid' }, logger: makeLogger() }, 'application-version/also-valid', []],
  [{ application: {}, logger: makeLogger() }, undefined, []],
  [{ logger: makeLogger() }, undefined, []],
  [undefined, undefined, undefined],

  // Above ones are 'valid' cases. Below are invalid.
  [
    { application: { id: 'bad tag' }, logger: makeLogger() },
    undefined, [
      { level: 'warn', matches: /Config option "application.id" must/ },
    ],
  ],
  [
    { application: { id: 'bad tag', version: 'good-tag' }, logger: makeLogger() },
    'application-version/good-tag', [
      { level: 'warn', matches: /Config option "application.id" must/ },
    ],
  ],
  [
    { application: { id: 'bad tag', version: 'also bad' }, logger: makeLogger() },
    undefined, [
      { level: 'warn', matches: /Config option "application.id" must/ },
      { level: 'warn', matches: /Config option "application.version" must/ },
    ],
  ],
  // Bad tags and no logger.
  [
    { application: { id: 'bad tag', version: 'also bad' }, logger: undefined },
    undefined, undefined,
  ],
])('given application tags configurations %p', (config, result, logs) => {
  describe('when getting tag values', () => {
    const tags = new ApplicationTags(config as unknown as ValidatedOptions);

    it('produces the correct tag values', () => {
      expect(tags.value).toEqual(result);
    });

    it('logs issues it encounters', () => {
      expect(config?.logger?.warn.mock.calls.length).toEqual(logs?.length);

      if (logs) {
        const expected = [...logs];
        config!.logger!.warn.mock.calls.forEach((call) => {
          const index = expected.findIndex(
            (expectedLog) => call[0].match(expectedLog.matches),
          );
          if (index < 0) {
            throw new Error(`Did not find expectation for ${call[0]}`);
          }
          expected.splice(index, 1);
        });
        if (expected.length) {
          throw new Error(`Did not find expected messages: ${expected.map((item) => item.matches.toString())}`);
        }
      }
    });
  });
});
