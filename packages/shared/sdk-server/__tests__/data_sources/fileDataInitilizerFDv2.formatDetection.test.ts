import {
  DataSourceErrorKind,
  LDPollingError,
  Platform,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import FileDataInitializerFDv2 from '../../src/data_sources/fileDataInitilizerFDv2';
import { createBasicPlatform } from '../createBasicPlatform';
import TestLogger, { LogLevel } from '../Logger';
import MockFilesystem from './filedata/MockFilesystem';

// The FDv2 file data initializer chooses the parser by file extension only. A .yml or .yaml file
// uses the YAML parser, and every other file uses JSON.parse, whatever the content looks like.

const jsonDocument = '{"flagValues": {"flag1": "value1"}}';
const yamlDocument = 'flagValues:\n  flag1: value1\n';

function flagValueOf(dataCallback: jest.Mock, key: string): any {
  const { payload } = dataCallback.mock.calls[0][1];
  const update = payload.updates.find((item: any) => item.kind === 'flag' && item.key === key);
  return update?.object.variations[0];
}

describe('given a file data initializer over files with different extensions', () => {
  let filesystem: MockFilesystem;
  let platform: Platform;
  let logger: TestLogger;
  let dataCallback: jest.Mock;
  let statusCallback: jest.Mock;
  let yamlParser: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    platform = { ...createBasicPlatform(), fileSystem: filesystem };
    logger = new TestLogger();
    dataCallback = jest.fn();
    statusCallback = jest.fn();
    yamlParser = jest.fn(() => ({ flagValues: { flag1: 'from-yaml-parser' } }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const load = async (path: string, data: string, withYamlParser: boolean = true) => {
    filesystem.set(path, data);
    const initializer = new FileDataInitializerFDv2(
      { type: 'file', paths: [path], yamlParser: withYamlParser ? yamlParser : undefined },
      platform,
      logger,
    );
    initializer.start(dataCallback, statusCallback);
    await jest.runAllTimersAsync();
    initializer.stop();
  };

  const expectMalformedDataFailure = () => {
    expect(dataCallback).not.toHaveBeenCalled();
    const closed = statusCallback.mock.calls.find(
      (call) => call[0] === subsystem.DataSourceState.Closed,
    );
    expect(closed).toBeDefined();
    expect(closed![1]).toBeInstanceOf(LDPollingError);
    expect(closed![1].kind).toEqual(DataSourceErrorKind.InvalidData);
    expect(closed![1].message).toEqual('Malformed data in file response');
    logger.expectMessages([{ level: LogLevel.Error, matches: /File contained invalid data/ }]);
  };

  it('parses a file without a YAML extension as JSON and does not consult the YAML parser', async () => {
    await load('data.txt', jsonDocument);

    expect(statusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
    expect(flagValueOf(dataCallback, 'flag1')).toEqual('value1');
    expect(yamlParser).not.toHaveBeenCalled();
  });

  it('reports malformed data for a .json file with YAML content even when a YAML parser is configured', async () => {
    await load('data.json', yamlDocument);

    expectMalformedDataFailure();
    expect(yamlParser).not.toHaveBeenCalled();
  });

  it.each(['yml', 'yaml'])(
    'parses a .%s file with the YAML parser even when its content looks like JSON',
    async (extension) => {
      await load(`data.${extension}`, jsonDocument);

      expect(yamlParser).toHaveBeenCalledWith(jsonDocument);
      expect(statusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
      expect(flagValueOf(dataCallback, 'flag1')).toEqual('from-yaml-parser');
    },
  );

  it.each(['yml', 'yaml'])(
    'reports malformed data for a .%s file when no YAML parser is configured',
    async (extension) => {
      await load(`data.${extension}`, jsonDocument, false);

      expectMalformedDataFailure();
      // The logged error names the file and the missing parser.
      logger.expectMessages([
        {
          level: LogLevel.Error,
          matches: new RegExp(
            `File contained invalid data.*Attempted to parse yaml file \\(data\\.${extension}\\) without parser\\.`,
          ),
        },
      ]);
    },
  );

  it('accepts a document whose members are not objects keyed by key', async () => {
    await load('data.json', '{"flags": [], "flagValues": null, "segments": 0}');

    expect(statusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
    expect(dataCallback).toHaveBeenCalledTimes(1);
    expect(dataCallback.mock.calls[0][1].payload.updates).toEqual([]);
  });
});
