import {
  DataSourceErrorKind,
  Filesystem,
  LDPollingError,
  Platform,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { FileSystemDataSourceConfiguration } from '../../src/api';
import FileDataInitializerFDv2 from '../../src/data_sources/fileDataInitilizerFDv2';
import { createBasicPlatform } from '../createBasicPlatform';
import TestLogger, { LogLevel } from '../Logger';
import MockFilesystem from './filedata/MockFilesystem';

// A YAML entry with no body parses to null, and the initializer keys entries by their map key,
// so the null reaches the payload processing step. That step must report it as invalid data,
// as it always has, rather than reject a promise nobody awaits.
it('reports a flag entry that is not an object as invalid data instead of rejecting', async () => {
  jest.useFakeTimers();
  const filesystem = new MockFilesystem();
  filesystem.set('/data/flags.json', '{"flags": {"my-flag": null}}');
  const platform: Platform = {
    ...createBasicPlatform(),
    fileSystem: filesystem as unknown as Filesystem,
  };
  const logger = new TestLogger();
  const dataCallback = jest.fn();
  const statusCallback = jest.fn();
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  process.on('unhandledRejection', onRejection);
  try {
    const options: FileSystemDataSourceConfiguration = {
      type: 'file',
      paths: ['/data/flags.json'],
    };
    const initializer = new FileDataInitializerFDv2(options, platform, logger);
    initializer.start(dataCallback, statusCallback);
    await jest.runAllTimersAsync();

    const closed = statusCallback.mock.calls.find(
      (call) => call[0] === subsystem.DataSourceState.Closed,
    );
    expect(closed).toBeDefined();
    const [, error] = closed ?? [];
    expect(error).toBeInstanceOf(LDPollingError);
    expect((error as LDPollingError).kind).toBe(DataSourceErrorKind.InvalidData);
    expect(dataCallback).not.toHaveBeenCalled();
    expect(logger.getCount(LogLevel.Error)).toBeGreaterThan(0);
    expect(rejections).toHaveLength(0);
  } finally {
    process.off('unhandledRejection', onRejection);
    jest.useRealTimers();
  }
});
