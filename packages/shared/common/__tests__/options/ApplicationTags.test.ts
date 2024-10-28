import ApplicationTags from '../../src/options/ApplicationTags';

describe.each([
  [
    {
      application: { id: 'is-valid', version: 'also-valid' },
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
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
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
    'application-id/is-valid application-name/test-app-1 application-version/also-valid application-version-name/test-version-1',
    [],
  ],
  [
    {
      application: { id: 'is-valid' },
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
    'application-id/is-valid',
    [],
  ],
  [
    {
      application: { version: 'also-valid' },
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
    'application-version/also-valid',
    [],
  ],
  [
    {
      application: {},
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
    undefined,
    [],
  ],
  [
    {
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
    undefined,
    [],
  ],
  [undefined, undefined, []],

  // Above ones are 'valid' cases. Below are invalid.
  [
    {
      application: { id: 'bad tag' },
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
    undefined,
    [/Config option "application.id" must/],
  ],
  [
    {
      application: { id: 'bad tag', version: 'good-tag' },
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    },
    'application-version/good-tag',
    [/Config option "application.id" must/],
  ],
  [
    {
      application: { id: 'bad tag', version: 'good-tag', name: '', versionName: 'test-version-1' },
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
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
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
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
      if (config?.logger) {
        expect(config?.logger?.warn).toHaveBeenCalledTimes(warnings.length);

        warnings.forEach((regExp) => {
          expect(config?.logger?.warn).toHaveBeenCalledWith(expect.stringMatching(regExp));
        });
      }
    });
  });
});
