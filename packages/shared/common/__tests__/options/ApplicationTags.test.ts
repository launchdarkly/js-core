import { createLogger } from '@launchdarkly/private-js-mocks';

import ApplicationTags from '../../src/options/ApplicationTags';

describe.each([
  [
    { application: { id: 'is-valid', version: 'also-valid' }, logger: createLogger() },
    'application-id/is-valid application-version/also-valid',
    [],
  ],
  [
    {
      application: {
        id: 'is-valid',
        version: 'also-valid',
        name: 'test-app-1',
        versionName: 'test-version-1',
      },
      logger: createLogger(),
    },
    'application-id/is-valid application-name/test-app-1 application-version/also-valid application-version-name/test-version-1',
    [],
  ],
  [{ application: { id: 'is-valid' }, logger: createLogger() }, 'application-id/is-valid', []],
  [
    { application: { version: 'also-valid' }, logger: createLogger() },
    'application-version/also-valid',
    [],
  ],
  [{ application: {}, logger: createLogger() }, undefined, []],
  [{ logger: createLogger() }, undefined, []],
  [undefined, undefined, []],

  // Above ones are 'valid' cases. Below are invalid.
  [
    { application: { id: 'bad tag' }, logger: createLogger() },
    undefined,
    [/Config option "application.id" must/],
  ],
  [
    { application: { id: 'bad tag', version: 'good-tag' }, logger: createLogger() },
    'application-version/good-tag',
    [/Config option "application.id" must/],
  ],
  [
    {
      application: { id: 'bad tag', version: 'good-tag', name: '', versionName: 'test-version-1' },
      logger: createLogger(),
    },
    'application-version/good-tag application-version-name/test-version-1',
    [/Config option "application.id" must/, /Config option "application.name" must/],
  ],
  [
    {
      application: {
        id: 'bad tag',
        version: 'also bad',
        name: 'invalid name',
        versionName: 'invalid version name',
      },
      logger: createLogger(),
    },
    undefined,
    [
      /Config option "application.id" must/,
      /Config option "application.version" must/,
      /Config option "application.name" must/,
      /Config option "application.versionName" must/,
    ],
  ],
  // Bad tags and no logger.
  [{ application: { id: 'bad tag', version: 'also bad' }, logger: undefined }, undefined, []],
])('given application tags configurations %j', (config, result, warnings: RegExp[]) => {
  describe('when getting tag values', () => {
    let tags: ApplicationTags;

    beforeEach(() => {
      // @ts-ignore
      tags = new ApplicationTags(config);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('produces the correct tag values', () => {
      expect(tags.value).toEqual(result);
    });

    it(`logs issues it encounters for ${JSON.stringify(config)}`, () => {
      expect(config?.logger?.warn).toHaveBeenCalledTimes(warnings.length);

      warnings.forEach((regExp) => {
        expect(config?.logger?.warn).toHaveBeenCalledWith(expect.stringMatching(regExp));
      });
    });
  });
});
