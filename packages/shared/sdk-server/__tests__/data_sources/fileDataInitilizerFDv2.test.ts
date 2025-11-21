import {
  DataSourceErrorKind,
  Filesystem,
  LDPollingError,
  Platform,
  subsystem,
  WatchHandle,
} from '@launchdarkly/js-sdk-common';

import { FileSystemDataSourceConfiguration } from '../../src/api';
import FileDataInitializerFDv2 from '../../src/data_sources/fileDataInitilizerFDv2';
import { createBasicPlatform } from '../createBasicPlatform';
import TestLogger, { LogLevel } from '../Logger';

class MockFilesystem implements Filesystem {
  public fileData: Record<
    string,
    {
      timestamp: number;
      data: string;
    }
  > = {};

  async getFileTimestamp(path: string): Promise<number> {
    return this.fileData[path]?.timestamp ?? 0;
  }

  async readFile(path: string): Promise<string> {
    if (!this.fileData[path]) {
      throw new Error('FILE NOT FOUND');
    }
    return this.fileData[path]?.data;
  }

  watch(_path: string, _callback: (eventType: string, filename: string) => void): WatchHandle {
    return {
      close: jest.fn(),
    };
  }
}

const flag1 = {
  key: 'flag1',
  on: true,
  fallthrough: { variation: 0 },
  variations: ['value1'],
  version: 1,
};

const segment1 = {
  key: 'segment1',
  include: ['user1'],
  version: 1,
};

const flagOnlyJson = JSON.stringify({
  flags: {
    flag1,
  },
});

const segmentOnlyJson = JSON.stringify({
  segments: {
    segment1,
  },
});

const allPropertiesJson = JSON.stringify({
  flags: {
    flag1,
  },
  segments: {
    segment1,
  },
});

describe('FileDataInitializerFDv2', () => {
  let mockFilesystem: MockFilesystem;
  let logger: TestLogger;
  let platform: Platform;
  let mockDataCallback: jest.Mock;
  let mockStatusCallback: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFilesystem = new MockFilesystem();
    logger = new TestLogger();
    platform = {
      ...createBasicPlatform(),
      fileSystem: mockFilesystem as unknown as Filesystem,
    };
    mockDataCallback = jest.fn();
    mockStatusCallback = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  it('throws error when paths are not provided', () => {
    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: [],
    };

    expect(() => {
      /* eslint-disable-next-line no-new */
      new FileDataInitializerFDv2(options, platform, logger);
    }).toThrow('FileDataInitializerFDv2: paths are required');
  });

  it('throws error when file system is not available', () => {
    const platformWithoutFileSystem = {
      ...createBasicPlatform(),
      fileSystem: undefined,
    };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['test.json'],
    };

    expect(() => {
      /* eslint-disable-next-line no-new */
      new FileDataInitializerFDv2(options, platformWithoutFileSystem, logger);
    }).toThrow('FileDataInitializerFDv2: file system is required');
  });

  it('loads and processes JSON file with flags and segments', async () => {
    mockFilesystem.fileData['test.json'] = { timestamp: 0, data: allPropertiesJson };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['test.json'],
    };

    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(mockDataCallback, mockStatusCallback);

    await jest.runAllTimersAsync();

    expect(mockStatusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
    expect(mockDataCallback).toHaveBeenCalled();
  });

  it('loads and processes multiple JSON files', async () => {
    mockFilesystem.fileData['flags.json'] = { timestamp: 0, data: flagOnlyJson };
    mockFilesystem.fileData['segments.json'] = { timestamp: 0, data: segmentOnlyJson };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['flags.json', 'segments.json'],
    };

    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(mockDataCallback, mockStatusCallback);

    await jest.runAllTimersAsync();

    expect(mockStatusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
    expect(mockDataCallback).toHaveBeenCalled();
  });

  it('loads and processes YAML file when parser is provided', async () => {
    const yamlData = 'flags:\n  flag1:\n    key: flag1\n    on: true\n    version: 1';
    const mockYamlParser = jest.fn((data: string) => {
      if (data === yamlData) {
        return {
          flags: {
            flag1,
          },
        };
      }
      return {};
    });

    mockFilesystem.fileData['test.yaml'] = { timestamp: 0, data: yamlData };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['test.yaml'],
      yamlParser: mockYamlParser,
    };

    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(mockDataCallback, mockStatusCallback);

    await jest.runAllTimersAsync();

    expect(mockYamlParser).toHaveBeenCalledWith(yamlData);
    expect(mockStatusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
    expect(mockDataCallback).toHaveBeenCalled();
  });

  it('throws error when YAML file is provided without parser', async () => {
    const yamlData = 'flags:\n  flag1:\n    key: flag1';
    mockFilesystem.fileData['test.yaml'] = { timestamp: 0, data: yamlData };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['test.yaml'],
    };

    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(mockDataCallback, mockStatusCallback);

    await jest.runAllTimersAsync();

    expect(mockStatusCallback).toHaveBeenCalledWith(
      subsystem.DataSourceState.Closed,
      expect.any(LDPollingError),
    );
    expect(logger.getCount(LogLevel.Error)).toBeGreaterThan(0);
  });

  it('handles invalid JSON gracefully', async () => {
    mockFilesystem.fileData['test.json'] = { timestamp: 0, data: 'invalid json {{{{' };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['test.json'],
    };

    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(mockDataCallback, mockStatusCallback);

    await jest.runAllTimersAsync();

    expect(mockStatusCallback).toHaveBeenCalledWith(
      subsystem.DataSourceState.Closed,
      expect.any(LDPollingError),
    );
    const errorCall = mockStatusCallback.mock.calls.find(
      (call) => call[0] === subsystem.DataSourceState.Closed && call[1] instanceof LDPollingError,
    );
    expect(errorCall).toBeDefined();
    if (errorCall && errorCall[1] instanceof LDPollingError) {
      expect(errorCall[1].kind).toBe(DataSourceErrorKind.InvalidData);
    }
    expect(logger.getCount(LogLevel.Error)).toBeGreaterThan(0);
  });

  it('combines data from multiple files correctly', async () => {
    const flag2 = {
      key: 'flag2',
      on: false,
      fallthrough: { variation: 0 },
      variations: ['value2'],
      version: 2,
    };
    const segment2 = {
      key: 'segment2',
      include: ['user2'],
      version: 2,
    };

    const flagFile = JSON.stringify({
      flags: {
        flag1,
        flag2,
      },
    });
    const segmentFile = JSON.stringify({
      segments: {
        segment1,
        segment2,
      },
    });

    mockFilesystem.fileData['flags.json'] = { timestamp: 0, data: flagFile };
    mockFilesystem.fileData['segments.json'] = { timestamp: 0, data: segmentFile };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['flags.json', 'segments.json'],
    };

    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(mockDataCallback, mockStatusCallback);

    await jest.runAllTimersAsync();

    expect(mockStatusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
    expect(mockDataCallback).toHaveBeenCalled();

    // Verify the combined data structure
    const dataCall = mockDataCallback.mock.calls[0];
    expect(dataCall[0]).toBe(false);
    expect(dataCall[1]).toHaveProperty('initMetadata');
    expect(dataCall[1]).toHaveProperty('payload');

    const { payload } = dataCall[1];
    expect(payload).toHaveProperty('updates');
    expect(Array.isArray(payload.updates)).toBe(true);

    // Verify all flags are present
    const flagUpdates = payload.updates.filter((update: any) => update.kind === 'flag');
    expect(flagUpdates.length).toBe(2);

    const flag1Update = flagUpdates.find((update: any) => update.key === 'flag1');
    expect(flag1Update).toBeDefined();
    expect(flag1Update.version).toBe(1);
    expect(flag1Update.object).toEqual(flag1);

    const flag2Update = flagUpdates.find((update: any) => update.key === 'flag2');
    expect(flag2Update).toBeDefined();
    expect(flag2Update.version).toBe(2);
    expect(flag2Update.object).toEqual(flag2);

    // Verify all segments are present
    const segmentUpdates = payload.updates.filter((update: any) => update.kind === 'segment');
    expect(segmentUpdates.length).toBe(2);

    const segment1Update = segmentUpdates.find((update: any) => update.key === 'segment1');
    expect(segment1Update).toBeDefined();
    expect(segment1Update.version).toBe(1);
    expect(segment1Update.object).toEqual(segment1);

    const segment2Update = segmentUpdates.find((update: any) => update.key === 'segment2');
    expect(segment2Update).toBeDefined();
    expect(segment2Update.version).toBe(2);
    expect(segment2Update.object).toEqual(segment2);
  });

  it('overwrites data when the same key appears in multiple files', async () => {
    // First file has flag1 with version 1
    const file1 = JSON.stringify({
      flags: {
        flag1: {
          ...flag1,
          version: 1,
        },
      },
    });

    // Second file has flag1 with version 2 (should overwrite)
    const file2 = JSON.stringify({
      flags: {
        flag1: {
          ...flag1,
          version: 2,
          on: false, // Different value to verify it's overwritten
        },
      },
    });

    mockFilesystem.fileData['file1.json'] = { timestamp: 0, data: file1 };
    mockFilesystem.fileData['file2.json'] = { timestamp: 0, data: file2 };

    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['file1.json', 'file2.json'],
    };

    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(mockDataCallback, mockStatusCallback);

    await jest.runAllTimersAsync();

    expect(mockStatusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
    expect(mockDataCallback).toHaveBeenCalled();

    // Verify that flag1 from file2 (version 2, on: false) overwrote file1
    const dataCall = mockDataCallback.mock.calls[0];
    const { payload } = dataCall[1];
    const flagUpdates = payload.updates.filter((update: any) => update.kind === 'flag');

    // Should only have one flag1 (not duplicated)
    const flag1Updates = flagUpdates.filter((update: any) => update.key === 'flag1');
    expect(flag1Updates.length).toBe(1);

    const flag1Update = flag1Updates[0];
    expect(flag1Update.version).toBe(2);
    expect(flag1Update.object.on).toBe(false); // Should be from file2
  });
});
