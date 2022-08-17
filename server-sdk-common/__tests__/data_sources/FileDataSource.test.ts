import { Context } from '@launchdarkly/js-sdk-common';
import promisify from '../../src/async/promisify';
import FileDataSourceFactory from '../../src/data_sources/FileDataSourceFactory';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import Evaluator from '../../src/evaluation/Evaluator';
import { Filesystem, WatchHandle } from '../../src/platform';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import basicPlatform from '../evaluation/mocks/platform';
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

// const allPropertiesYaml = `
// flags:
//   ${flag1Key}:
//     key: ${flag1Key}
//     on: true
//     fallthrough:
//       variation: 2
//     variations:
//       - fall
//       - off
//       - on
// flagValues:
//   ${flag2Key}: "${flag2Value}"
// segments:
//   ${segment1Key}:
//     key: ${segment1Key}
//     include:
//       - user1
// `;

function sorted(a: any[]) {
  const a1 = Array.from(a);
  a1.sort();
  return a1;
}

class MockFilesystem implements Filesystem {
  public fileData: Record<string, {
    timestamp: number,
    data: string
  }> = {};

  public watches: Record<string,
  (WatchHandle & { id: number, cb: (eventType: string, filename: string) => void }
  )[]> = {};

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

  beforeEach(() => {
    filesystem = new MockFilesystem();
    logger = new TestLogger();
    featureStore = new InMemoryFeatureStore();
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('does not load flags prior to start', async () => {
    filesystem.fileData['testfile.json'] = { timestamp: 0, data: '{"flagValues":{"key":"value"}}' };
    jest.spyOn(filesystem, 'readFile');

    const factory = new FileDataSourceFactory({
      paths: ['testfile.json'],
    });

    factory.create({
      featureStore,
      logger,
    }, filesystem);

    expect(await asyncFeatureStore.initialized()).toBeFalsy();

    expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
    expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
    // There was no file access.
    expect(filesystem.readFile).toHaveBeenCalledTimes(0);
  });

  it('loads all properties', (done) => {
    filesystem.fileData['testfile.json'] = { timestamp: 0, data: allPropertiesJson };
    jest.spyOn(filesystem, 'readFile');

    const factory = new FileDataSourceFactory({
      paths: ['testfile.json'],
    });

    const fds = factory.create({
      featureStore,
      logger,
    }, filesystem);

    fds.start(async () => {
      expect(await asyncFeatureStore.initialized()).toBeTruthy();

      const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
      expect(sorted(Object.keys(flags))).toEqual([flag1Key, flag2Key]);

      const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
      expect(segments).toEqual({ seg1: segment1 });
      expect(filesystem.readFile).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('does not load if a file it not found', (done) => {
    const factory = new FileDataSourceFactory({
      paths: ['missing-file.json'],
    });

    const fds = factory.create({
      featureStore,
      logger,
    }, filesystem);

    fds.start(async (err) => {
      expect(err).toBeDefined();
      expect(await asyncFeatureStore.initialized()).toBeFalsy();

      expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
      expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
      done();
    });
  });

  it('does not load if a file was malformed', (done) => {
    filesystem.fileData['malformed_file.json'] = { timestamp: 0, data: '{sorry' };
    jest.spyOn(filesystem, 'readFile');
    const factory = new FileDataSourceFactory({
      paths: ['malformed_file.json'],
    });

    const fds = factory.create({
      featureStore,
      logger,
    }, filesystem);

    fds.start(async (err) => {
      expect(err).toBeDefined();
      expect(await asyncFeatureStore.initialized()).toBeFalsy();

      expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
      expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
      expect(filesystem.readFile).toHaveBeenCalledWith('malformed_file.json');
      done();
    });
  });

  it('can load multiple files', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: flagOnlyJson };
    filesystem.fileData['file2.json'] = { timestamp: 0, data: segmentOnlyJson };

    jest.spyOn(filesystem, 'readFile');
    const factory = new FileDataSourceFactory({
      paths: ['file1.json', 'file2.json'],
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async () => {
      expect(await asyncFeatureStore.initialized()).toBeTruthy();

      const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
      expect(sorted(Object.keys(flags))).toEqual([flag1Key]);

      const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
      expect(segments).toEqual({ seg1: segment1 });
      expect(filesystem.readFile).toHaveBeenCalledTimes(2);
      done();
    });
  });

  it('does not allow duplicate keys', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: flagOnlyJson };
    filesystem.fileData['file2.json'] = { timestamp: 0, data: flagOnlyJson };

    jest.spyOn(filesystem, 'readFile');
    const factory = new FileDataSourceFactory({
      paths: ['file1.json', 'file2.json'],
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async (err) => {
      expect(err).toBeDefined();
      expect(await asyncFeatureStore.initialized()).toBeFalsy();
      expect(filesystem.readFile).toHaveBeenCalledTimes(2);
      done();
    });
  });

  it('does not create watchers if auto-update if off', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: flagOnlyJson };
    filesystem.fileData['file2.json'] = { timestamp: 0, data: segmentOnlyJson };

    jest.spyOn(filesystem, 'watch');
    const factory = new FileDataSourceFactory({
      paths: ['file1.json', 'file2.json'],
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async () => {
      expect(await asyncFeatureStore.initialized()).toBeTruthy();
      expect(filesystem.watch).toHaveBeenCalledTimes(0);
      done();
    });
  });

  // TODO: Use the full client for some evaluations when it is merged together.

  it('can evaluate simple loaded flags', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: allPropertiesJson };

    const factory = new FileDataSourceFactory({
      paths: ['file1.json'],
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async () => {
      const evaluator = new Evaluator(basicPlatform, {
        getFlag: async (key) => (await asyncFeatureStore.get(
          VersionedDataKinds.Features,
          key,
        ) as Flag ?? undefined),
        getSegment: async (key) => (await asyncFeatureStore.get(
          VersionedDataKinds.Segments,
          key,
        ) as Segment) ?? undefined,
        getBigSegmentsMembership: () => Promise.resolve(undefined),
      });

      const flag = await asyncFeatureStore.get(VersionedDataKinds.Features, flag2Key);
      const res = await evaluator.evaluate(
        flag as Flag,
        Context.fromLDContext({ key: 'userkey' })!,
      );
      expect(res.detail.value).toEqual(flag2Value);
      done();
    });
  });

  it('can evaluate full loaded flags', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: allPropertiesJson };

    const factory = new FileDataSourceFactory({
      paths: ['file1.json'],
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async () => {
      const evaluator = new Evaluator(basicPlatform, {
        getFlag: async (key) => (await asyncFeatureStore.get(
          VersionedDataKinds.Features,
          key,
        ) as Flag ?? undefined),
        getSegment: async (key) => (await asyncFeatureStore.get(
          VersionedDataKinds.Segments,
          key,
        ) as Segment) ?? undefined,
        getBigSegmentsMembership: () => Promise.resolve(undefined),
      });

      const flag = await asyncFeatureStore.get(VersionedDataKinds.Features, flag1Key);
      const res = await evaluator.evaluate(
        flag as Flag,
        Context.fromLDContext({ key: 'userkey' })!,
      );
      expect(res.detail.value).toEqual('on');
      done();
    });
  });

  it(
    'register watchers when auto update is enabled and unregisters them when it is closed',
    (done) => {
      filesystem.fileData['file1.json'] = { timestamp: 0, data: flagOnlyJson };
      filesystem.fileData['file2.json'] = { timestamp: 0, data: segmentOnlyJson };

      jest.spyOn(filesystem, 'watch');
      const factory = new FileDataSourceFactory({
        paths: ['file1.json', 'file2.json'],
        autoUpdate: true,
      });

      const fds = factory.create({
        featureStore, logger,
      }, filesystem);

      fds.start(async () => {
        expect(await asyncFeatureStore.initialized()).toBeTruthy();
        expect(filesystem.watch).toHaveBeenCalledTimes(2);
        expect(filesystem.watches['file1.json'].length).toEqual(1);
        expect(filesystem.watches['file2.json'].length).toEqual(1);
        fds.close();

        expect(filesystem.watches['file1.json'].length).toEqual(0);
        expect(filesystem.watches['file2.json'].length).toEqual(0);
        done();
      });
    },
  );

  it('reloads modified files when auto update is enabled', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: flagOnlyJson };

    jest.spyOn(filesystem, 'watch');
    const factory = new FileDataSourceFactory({
      paths: ['file1.json'],
      autoUpdate: true,
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async () => {
      expect(await asyncFeatureStore.initialized()).toBeTruthy();

      const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
      expect(Object.keys(flags).length).toEqual(1);

      const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
      expect(Object.keys(segments).length).toEqual(0);

      // Need to update the timestamp, or it will think the file has not changed.
      filesystem.fileData['file1.json'] = { timestamp: 100, data: segmentOnlyJson };
      filesystem.watches['file1.json'][0].cb('change', 'file1.json');

      // The handling of the file loading is async, and additionally we debounce
      // the callback. So we have to wait a bit to account for the awaits and the debounce.
      setTimeout(async () => {
        const flags2 = await asyncFeatureStore.all(VersionedDataKinds.Features);
        expect(Object.keys(flags2).length).toEqual(0);

        const segments2 = await asyncFeatureStore.all(VersionedDataKinds.Segments);
        expect(Object.keys(segments2).length).toEqual(1);
        done();
      }, 100);
    });
  });

  it('debounces the callback for file loading', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: flagOnlyJson };

    jest.spyOn(filesystem, 'watch');
    jest.spyOn(featureStore, 'init');
    const factory = new FileDataSourceFactory({
      paths: ['file1.json'],
      autoUpdate: true,
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async () => {
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
      setTimeout(async () => {
        // Once for the start, and then again for the coalesced update.
        expect(featureStore.init).toHaveBeenCalledTimes(2);
        done();
      }, 100);
    });
  });

  it('does not callback if the timestamp has not changed', (done) => {
    filesystem.fileData['file1.json'] = { timestamp: 0, data: flagOnlyJson };

    jest.spyOn(filesystem, 'watch');
    jest.spyOn(featureStore, 'init');
    const factory = new FileDataSourceFactory({
      paths: ['file1.json'],
      autoUpdate: true,
    });

    const fds = factory.create({
      featureStore, logger,
    }, filesystem);

    fds.start(async () => {
      expect(await asyncFeatureStore.initialized()).toBeTruthy();

      const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
      expect(Object.keys(flags).length).toEqual(1);

      const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
      expect(Object.keys(segments).length).toEqual(0);

      filesystem.watches['file1.json'][0].cb('change', 'file1.json');
      filesystem.watches['file1.json'][0].cb('change', 'file1.json');

      // The handling of the file loading is async, and additionally we debounce
      // the callback. So we have to wait a bit to account for the awaits and the debounce.
      setTimeout(async () => {
        // Once for the start.
        expect(featureStore.init).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });
  });

  it.each([['yml'], ['yaml']])(
    'does not initialize when a yaml file is specified, but no parser is provided %s',
    async (ext) => {
      jest.spyOn(filesystem, 'readFile');
      const fileName = `yamlfile.${ext}`;
      filesystem.fileData[fileName] = { timestamp: 0, data: '' };
      const factory = new FileDataSourceFactory({
        paths: [fileName],
      });

      const fds = factory.create({
        featureStore,
        logger,
      }, filesystem);

      const err = await promisify((cb) => {
        fds.start(cb);
      });

      expect((err as any).message)
        .toEqual(`Attempted to parse yaml file (yamlfile.${ext}) without parser.`);
      expect(await asyncFeatureStore.initialized()).toBeFalsy();

      expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
      expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
    },
  );

  it.each([['yml'], ['yaml']])('uses the yaml parser when specified %s', async (ext) => {
    const parser = jest.fn(() => (JSON.parse(allPropertiesJson)));

    jest.spyOn(filesystem, 'readFile');
    const fileName = `yamlfile.${ext}`;
    filesystem.fileData[fileName] = { timestamp: 0, data: 'the data' };
    const factory = new FileDataSourceFactory({
      paths: [fileName],
      yamlParser: parser,
    });

    const fds = factory.create({
      featureStore,
      logger,
    }, filesystem);

    const err = await promisify((cb) => {
      fds.start(cb);
    });

    expect(err).toBeUndefined();
    expect(await asyncFeatureStore.initialized()).toBeTruthy();

    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(sorted(Object.keys(flags))).toEqual([flag1Key, flag2Key]);

    const segments = await asyncFeatureStore.all(VersionedDataKinds.Segments);
    expect(segments).toEqual({ seg1: segment1 });
    expect(filesystem.readFile).toHaveBeenCalledTimes(1);
    expect(parser).toHaveBeenCalledWith('the data');
  });
});
