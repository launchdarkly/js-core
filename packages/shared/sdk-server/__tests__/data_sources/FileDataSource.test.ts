import { ClientContext, Context, Filesystem, WatchHandle } from '@launchdarkly/js-sdk-common';

import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import Evaluator from '../../src/evaluation/Evaluator';
import { FileDataSourceFactory } from '../../src/integrations';
import Configuration from '../../src/options/Configuration';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import { createBasicPlatform } from '../createBasicPlatform';
import TestLogger from '../Logger';

const flag1Key = 'flag1';
const flag2Key = 'flag2';
const flag2Value = 'value2';
const segment1Key = 'seg1';

const flag1 = {
  key: flag1Key,
  on: true,
  fallthrough: {
    variation: 2,
  },
  variations: ['fall', 'off', 'on'],
};

const segment1 = {
  key: segment1Key,
  include: ['user1'],
};

const flagOnlyJson = `
{
  "flags": {
    "${flag1Key}": ${JSON.stringify(flag1)}
  }
}`;

const segmentOnlyJson = `
{
  "segments": {
    "${segment1Key}": ${JSON.stringify(segment1)}
  }
}`;

const allPropertiesJson = `
{
  "flags": {
    "${flag1Key}": ${JSON.stringify(flag1)}
  },
  "flagValues": {
    "${flag2Key}": "${flag2Value}"
  },
  "segments": {
    "${segment1Key}": ${JSON.stringify(segment1)}
  }
}`;

function sorted(a: any[]) {
  const a1 = Array.from(a);
  a1.sort();
  return a1;
}

class MockFilesystem implements Filesystem {
  public fileData: Record<
    string,
    {
      timestamp: number;
      data: string;
    }
  > = {};

  public watches: Record<
    string,
    (WatchHandle & { id: number; cb: (eventType: string, filename: string) => void })[]
  > = {};

  public watchHandleId = 0;

  async getFileTimestamp(path: string): Promise<number> {
    return this.fileData[path]?.timestamp;
  }

  async readFile(path: string): Promise<string> {
    if (!this.fileData[path]) {
      throw new Error('FILE NOT FOUND');
    }
    return this.fileData[path]?.data;
  }

  watch(path: string, callback: (eventType: string, filename: string) => void): WatchHandle {
    if (!this.watches[path]) {
      this.watches[path] = [];
    }
    const watchHandles = this.watches;
    const id = this.watchHandleId;
    const newHandle = {
      id,
      close: () => {
        const index = watchHandles[path].findIndex((handle) => handle.id === id);
        if (index >= 0) {
          watchHandles[path].splice(index, 1);
        }
      },
      cb: callback,
    };
    this.watches[path].push(newHandle);

    this.watchHandleId += 1;

    return newHandle;
  }
}

describe('given a mock filesystem and memory feature store', () => {
  let filesystem: MockFilesystem;
  let logger: TestLogger;
  let featureStore: InMemoryFeatureStore;
  let asyncFeatureStore: AsyncStoreFacade;
  let createFileDataSource: any;
  let mockInitSuccessHandler: jest.Mock;
  let mockErrorHandler: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();

    mockInitSuccessHandler = jest.fn();
    mockErrorHandler = jest.fn();
    filesystem = new MockFilesystem();
    logger = new TestLogger();
    featureStore = new InMemoryFeatureStore();
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
    jest.spyOn(filesystem, 'readFile');
    jest.spyOn(filesystem, 'watch');
    jest.spyOn(featureStore, 'init');

    const defaultData = {
      flagValues: {
        key: 'value',
      },
    };
    const defaultDataString = JSON.stringify(defaultData);
    const defaultTestFilePath = 'testFile.json';
    const defaultTestFilePathData = [{ path: defaultTestFilePath, data: defaultDataString }];

    // setup a filesystem of paths pointing to data
    // returns an array of paths
    const setupFileSystem = (testFiles: { path: string; data: string }[]) =>
      testFiles.map(({ path, data }) => {
        filesystem.fileData[path] = { timestamp: 0, data };
        return path;
      });

    createFileDataSource = async (
      start: boolean = true,
      files: { path: string; data: string }[] = defaultTestFilePathData,
      simulateMissingFile: boolean = false,
      autoUpdate: boolean = false,
      yamlParser?: (data: string) => any,
    ) => {
      const filePaths = setupFileSystem(files);
      if (simulateMissingFile) {
        filePaths.push('missing-file.json');
      }
      const factory = new FileDataSourceFactory({
        paths: filePaths,
        autoUpdate,
        yamlParser,
      });

      const fileDataSource = factory.create(
        new ClientContext(
          '',
          new Configuration({
            featureStore,
            logger,
          }),
          {
            ...createBasicPlatform(),
            fileSystem: filesystem as unknown as Filesystem,
          },
        ),
        featureStore,
        mockInitSuccessHandler,
        mockErrorHandler,
      );

      if (start) {
        fileDataSource.start();
      }

      await jest.runAllTimersAsync();
      return fileDataSource;
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  it('does not load flags prior to start', async () => {
    await createFileDataSource(false);

    expect(await asyncFeatureStore.initialized()).toBeFalsy();
    expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
    expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
    // There was no file access.
    expect(filesystem.readFile).not.toHaveBeenCalled();
  });

  it('loads all properties', async () => {
    await createFileDataSource(true, [{ path: 'allProperties.json', data: allPropertiesJson }]);

    expect(mockInitSuccessHandler).toBeCalled();
    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(sorted(Object.keys(flags))).toEqual([flag1Key, flag2Key]);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(segments).toEqual({ seg1: segment1 });
    expect(filesystem.readFile).toHaveBeenCalledTimes(1);
  });

  it('does not load if a file it not found', async () => {
    await createFileDataSource(true, undefined, true);

    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/not found/i);
    expect(filesystem.readFile).toHaveBeenCalledWith('missing-file.json');
    expect(await asyncFeatureStore.initialized()).toBeFalsy();
    expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
    expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
  });

  it('does not load if a file was malformed', async () => {
    await createFileDataSource(true, [{ path: 'allProperties.json', data: '{malformed' }]);

    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/expected.*json at position/i);
    expect(await asyncFeatureStore.initialized()).toBeFalsy();
    expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
    expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
  });

  it('can load multiple files', async () => {
    await createFileDataSource(true, [
      { path: 'file1.json', data: flagOnlyJson },
      { path: 'file2.json', data: segmentOnlyJson },
    ]);

    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(sorted(Object.keys(flags))).toEqual([flag1Key]);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(segments).toEqual({ seg1: segment1 });

    expect(filesystem.readFile).toHaveBeenCalledTimes(2);
    expect(filesystem.readFile).toHaveBeenNthCalledWith(1, 'file1.json');
    expect(filesystem.readFile).toHaveBeenNthCalledWith(2, 'file2.json');
  });

  it('does not allow duplicate keys', async () => {
    await createFileDataSource(true, [
      { path: 'file1.json', data: flagOnlyJson },
      { path: 'file2.json', data: flagOnlyJson },
    ]);

    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/duplicate.*flag1/);
    expect(await asyncFeatureStore.initialized()).toBeFalsy();
    expect(filesystem.readFile).toHaveBeenCalledTimes(2);
  });

  it('does not create watchers if auto-update if off', async () => {
    await createFileDataSource(true, [
      { path: 'file1.json', data: flagOnlyJson },
      { path: 'file2.json', data: segmentOnlyJson },
    ]);

    expect(await asyncFeatureStore.initialized()).toBeTruthy();
    expect(filesystem.watch).not.toBeCalled();
  });

  it('can evaluate simple loaded flags', async () => {
    await createFileDataSource(true, [{ path: 'file1.json', data: allPropertiesJson }]);

    const evaluator = new Evaluator(createBasicPlatform(), {
      getFlag: async (key) =>
        ((await asyncFeatureStore.get(VersionedDataKinds.Features, key)) as Flag) ?? undefined,
      getSegment: async (key) =>
        ((await asyncFeatureStore.get(VersionedDataKinds.Segments, key)) as Segment) ?? undefined,
      getBigSegmentsMembership: () => Promise.resolve(undefined),
    });
    const flag = await asyncFeatureStore.get(VersionedDataKinds.Features, flag2Key);
    const res = await evaluator.evaluate(flag as Flag, Context.fromLDContext({ key: 'userkey' })!);

    expect(res.detail.value).toEqual(flag2Value);
  });

  it('can evaluate full loaded flags', async () => {
    await createFileDataSource(true, [{ path: 'file1.json', data: allPropertiesJson }]);
    const evaluator = new Evaluator(createBasicPlatform(), {
      getFlag: async (key) =>
        ((await asyncFeatureStore.get(VersionedDataKinds.Features, key)) as Flag) ?? undefined,
      getSegment: async (key) =>
        ((await asyncFeatureStore.get(VersionedDataKinds.Segments, key)) as Segment) ?? undefined,
      getBigSegmentsMembership: () => Promise.resolve(undefined),
    });
    const flag = await asyncFeatureStore.get(VersionedDataKinds.Features, flag1Key);
    const res = await evaluator.evaluate(flag as Flag, Context.fromLDContext({ key: 'userkey' })!);

    expect(res.detail.value).toEqual('on');
  });

  it('register watchers when auto update is enabled and unregisters them when it is closed', async () => {
    const fds = await createFileDataSource(
      true,
      [
        { path: 'file1.json', data: flagOnlyJson },
        { path: 'file2.json', data: segmentOnlyJson },
      ],
      false,
      true,
    );

    expect(await asyncFeatureStore.initialized()).toBeTruthy();
    expect(filesystem.watch).toHaveBeenCalledTimes(2);
    expect(filesystem.watches['file1.json'].length).toEqual(1);
    expect(filesystem.watches['file2.json'].length).toEqual(1);
    fds.close();

    expect(filesystem.watches['file1.json'].length).toEqual(0);
    expect(filesystem.watches['file2.json'].length).toEqual(0);
  });

  it('reloads modified files when auto update is enabled', async () => {
    await createFileDataSource(true, [{ path: 'file1.json', data: flagOnlyJson }], false, true);

    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(Object.keys(flags).length).toEqual(1);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(Object.keys(segments).length).toEqual(0);

    // Need to update the timestamp, or it will think the file has not changed.
    filesystem.fileData['file1.json'] = { timestamp: 100, data: segmentOnlyJson };
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');

    await jest.runAllTimersAsync();
    const flags2 = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(Object.keys(flags2).length).toEqual(0);

    const segments2 = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(Object.keys(segments2).length).toEqual(1);
  });

  it('debounces the callback for file loading', async () => {
    await createFileDataSource(true, [{ path: 'file1.json', data: flagOnlyJson }], false, true);

    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(Object.keys(flags).length).toEqual(1);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(Object.keys(segments).length).toEqual(0);

    // Trigger several change callbacks.
    filesystem.fileData['file1.json'] = { timestamp: 100, data: segmentOnlyJson };
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');
    filesystem.fileData['file1.json'] = { timestamp: 101, data: segmentOnlyJson };
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');
    filesystem.fileData['file1.json'] = { timestamp: 102, data: segmentOnlyJson };
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');
    filesystem.fileData['file1.json'] = { timestamp: 103, data: segmentOnlyJson };
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');

    // The handling of the file loading is async, and additionally we debounce
    // the callback. So we have to wait a bit to account for the awaits and the debounce.
    // Once for the start, and then again for the coalesced update.
    await jest.runAllTimersAsync();
    expect(featureStore.init).toHaveBeenCalledTimes(2);
  });

  it('does not callback if the timestamp has not changed', async () => {
    await createFileDataSource(true, [{ path: 'file1.json', data: flagOnlyJson }], false, true);

    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(Object.keys(flags).length).toEqual(1);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(Object.keys(segments).length).toEqual(0);

    filesystem.watches['file1.json'][0].cb('change', 'file1.json');
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');

    await jest.runAllTimersAsync();
    // Once for the start.
    expect(featureStore.init).toHaveBeenCalledTimes(1);
  });

  it.each([['yml'], ['yaml']])(
    'does not initialize when a yaml file is specified, but no parser is provided %s',
    async (ext) => {
      const fileName = `yamlfile.${ext}`;
      await createFileDataSource(true, [{ path: fileName, data: '' }]);

      expect(mockErrorHandler.mock.lastCall[0].message).toEqual(
        `Attempted to parse yaml file (yamlfile.${ext}) without parser.`,
      );
      expect(await asyncFeatureStore.initialized()).toBeFalsy();
      expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
      expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
    },
  );

  it.each([['yml'], ['yaml']])('uses the yaml parser when specified %s', async (ext) => {
    const yamlParser = jest.fn(() => JSON.parse(allPropertiesJson));
    const fileName = `yamlfile.${ext}`;
    await createFileDataSource(
      true,
      [{ path: fileName, data: 'the data' }],
      undefined,
      undefined,
      yamlParser,
    );

    expect(mockErrorHandler).not.toBeCalled();
    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(sorted(Object.keys(flags))).toEqual([flag1Key, flag2Key]);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(segments).toEqual({ seg1: segment1 });
    expect(filesystem.readFile).toHaveBeenCalledTimes(1);
    expect(yamlParser).toHaveBeenCalledWith('the data');
  });

  it('it updates the version numbers for value based flags when their values change', async () => {
    await createFileDataSource(
      true,
      [
        {
          path: 'file1.json',
          data: `{
            "flagValues":
            {
              "${flag2Key}": "${flag2Value}"
            }
          }`,
        },
      ],
      false,
      true,
    );

    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(Object.keys(flags).length).toEqual(1);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(Object.keys(segments).length).toEqual(0);

    // Need to update the timestamp, or it will think the file has not changed.
    filesystem.fileData['file1.json'] = {
      timestamp: 100,
      data: `{
      "flagValues":
      {
        "${flag2Key}": "differentValue"
      }
    }`,
    };
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');

    await jest.runAllTimersAsync();

    const readFlag = await asyncFeatureStore.get(VersionedDataKinds.Features, flag2Key);
    expect(readFlag?.version).toEqual(2);
  });

  it('it does not update the version when the value does not change', async () => {
    await createFileDataSource(
      true,
      [
        {
          path: 'file1.json',
          data: `{
            "flagValues":
            {
              "${flag2Key}": "${flag2Value}"
            }
          }`,
        },
      ],
      false,
      true,
    );

    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(Object.keys(flags).length).toEqual(1);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(Object.keys(segments).length).toEqual(0);

    // Need to update the timestamp, or it will think the file has not changed.
    filesystem.fileData['file1.json'] = {
      timestamp: 100,
      data: `{
      "flagValues":
      {
        "${flag2Key}": "${flag2Value}"
      }
    }`,
    };
    filesystem.watches['file1.json'][0].cb('change', 'file1.json');

    await jest.runAllTimersAsync();

    const readFlag = await asyncFeatureStore.get(VersionedDataKinds.Features, flag2Key);
    expect(readFlag?.version).toEqual(1);
  });
});
