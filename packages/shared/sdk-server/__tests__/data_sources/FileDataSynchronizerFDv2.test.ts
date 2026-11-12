import {
  CompositeDataSource,
  DataSourceErrorKind,
  LDPollingError,
  Platform,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { FileSystemDataSourceConfiguration } from '../../src/api';
import { DEFAULT_DEBOUNCE_DELAY_MS, DEFAULT_RETRY_DELAY_MS } from '../../src/data_sources/filedata';
import FileDataSynchronizerFDv2, {
  SharedFileFlags,
} from '../../src/data_sources/FileDataSynchronizerFDv2';
import { createBasicPlatform } from '../createBasicPlatform';
import TestLogger, { LogLevel } from '../Logger';
import MockFilesystem from './filedata/MockFilesystem';

const directory = '/data';
const path = `${directory}/flags.json`;
const document = (value: string) => JSON.stringify({ flagValues: { flag: value } });

// The flag that the payload of one data callback call carries.
const flagIn = (call: any[]) =>
  call[1].payload.updates.find((update: any) => update.kind === 'flag' && update.key === 'flag')
    ?.object;

describe('given a file data synchronizer over a mock filesystem', () => {
  let filesystem: MockFilesystem;
  let platform: Platform;
  let logger: TestLogger;
  let dataCallback: jest.Mock;
  let statusCallback: jest.Mock;
  let synchronizer: FileDataSynchronizerFDv2 | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    platform = { ...createBasicPlatform(), fileSystem: filesystem };
    logger = new TestLogger();
    dataCallback = jest.fn();
    statusCallback = jest.fn();
  });

  afterEach(() => {
    synchronizer?.stop();
    synchronizer = undefined;
    jest.useRealTimers();
  });

  const start = (options: Partial<FileSystemDataSourceConfiguration> = {}) => {
    synchronizer = new FileDataSynchronizerFDv2(
      { type: 'file', paths: [path], ...options },
      platform,
      logger,
    );
    synchronizer.start(dataCallback, statusCallback);
    return synchronizer;
  };

  it('throws when paths are not provided', () => {
    expect(() => start({ paths: [] })).toThrow('FileDataSynchronizerFDv2: paths are required');
  });

  it('throws when the platform has no file system', () => {
    platform = { ...createBasicPlatform(), fileSystem: undefined };

    expect(() => start()).toThrow('FileDataSynchronizerFDv2: file system is required');
  });

  it('sends a full payload without a selector and then reports the state valid', async () => {
    filesystem.set(path, document('a'));

    // Load the file.
    start();
    await jest.runAllTimersAsync();

    // One full payload without a selector arrives before the state valid. It is not a basis.
    expect(dataCallback).toHaveBeenCalledTimes(1);
    const [basis, { payload }] = dataCallback.mock.calls[0];
    expect(basis).toBe(false);
    expect(payload.type).toEqual('full');
    expect(payload.state).toEqual('');
    expect(flagIn(dataCallback.mock.calls[0])).toMatchObject({ variations: ['a'], version: 1 });
    expect(statusCallback.mock.calls).toEqual([[subsystem.DataSourceState.Valid]]);
    expect(dataCallback.mock.invocationCallOrder[0]).toBeLessThan(
      statusCallback.mock.invocationCallOrder[0],
    );
  });

  it.each([
    { failure: 'a missing file', data: undefined, kind: DataSourceErrorKind.NetworkError },
    {
      failure: 'a file that cannot be parsed',
      data: '{"flagValues"',
      kind: DataSourceErrorKind.InvalidData,
    },
  ])(
    'reports the state interrupted with an error when the first load finds $failure without autoUpdate',
    async ({ data, kind }) => {
      if (data !== undefined) {
        filesystem.set(path, data);
      }

      // Try to load the file.
      start();
      await jest.runAllTimersAsync();

      // No data arrives, the state is interrupted with an error of the expected kind, and the
      // failure is logged.
      expect(dataCallback).not.toHaveBeenCalled();
      expect(statusCallback).toHaveBeenCalledTimes(1);
      const [state, error] = statusCallback.mock.calls[0];
      expect(state).toEqual(subsystem.DataSourceState.Interrupted);
      expect(error).toBeInstanceOf(LDPollingError);
      expect((error as LDPollingError).kind).toEqual(kind);
      expect(logger.getCount(LogLevel.Error)).toEqual(1);
    },
  );

  it.each([
    { failure: 'a missing file', data: undefined },
    { failure: 'a file that cannot be parsed', data: '{"flagValues"' },
  ])(
    'reports the state interrupted without an error when the first load finds $failure with autoUpdate',
    async ({ data }) => {
      if (data !== undefined) {
        filesystem.set(path, data);
      }

      // Try to load the file.
      start({ autoUpdate: true });
      await jest.advanceTimersByTimeAsync(0);

      // No data arrives, the state is interrupted without an error, and the failure is logged.
      expect(dataCallback).not.toHaveBeenCalled();
      expect(statusCallback.mock.calls).toEqual([[subsystem.DataSourceState.Interrupted]]);
      expect(logger.getCount(LogLevel.Error)).toEqual(1);
    },
  );

  it('stays in place in a composite data source and loads the file when it appears', async () => {
    const factory = jest.fn(
      () =>
        new FileDataSynchronizerFDv2(
          { type: 'file', paths: [path], autoUpdate: true },
          platform,
          logger,
        ),
    );
    const composite = new CompositeDataSource([], [factory], []);
    try {
      // Start without the file and let several automatic retries run.
      composite.start(dataCallback, statusCallback);
      await jest.advanceTimersByTimeAsync(5 * DEFAULT_RETRY_DELAY_MS);

      // The first synchronizer stays in place and logged the failure at error level one time.
      expect(factory).toHaveBeenCalledTimes(1);
      expect(logger.getCount(LogLevel.Error)).toEqual(1);
      expect(dataCallback).not.toHaveBeenCalled();

      // Create the file and report the change.
      filesystem.set(path, document('a'));
      filesystem.emit(directory, 'rename', 'flags.json');
      await jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DELAY_MS);

      // The data from the file arrives through the same synchronizer.
      expect(factory).toHaveBeenCalledTimes(1);
      expect(dataCallback).toHaveBeenCalledTimes(1);
      expect(flagIn(dataCallback.mock.calls[0])).toMatchObject({ variations: ['a'] });
      expect(statusCallback).toHaveBeenLastCalledWith(subsystem.DataSourceState.Valid, undefined);
    } finally {
      composite.stop();
    }
  });

  it('does not watch the files when autoUpdate is not set', async () => {
    filesystem.set(path, document('a'));

    // Load the file.
    start();
    await jest.runAllTimersAsync();

    // The synchronizer has set up no watches.
    expect(filesystem.watches).toHaveLength(0);
  });

  it('sends a full payload with the new data when a watched file changes', async () => {
    filesystem.set(path, document('a'));
    start({ autoUpdate: true });
    await jest.runAllTimersAsync();

    // Change the file and report the change.
    filesystem.set(path, document('b'));
    filesystem.emit(directory, 'change');
    await jest.runAllTimersAsync();

    // A second full payload has the new value with a higher version, and the state stays valid.
    expect(dataCallback).toHaveBeenCalledTimes(2);
    expect(flagIn(dataCallback.mock.calls[1])).toMatchObject({ variations: ['b'], version: 2 });
    expect(statusCallback.mock.calls).toEqual([
      [subsystem.DataSourceState.Valid],
      [subsystem.DataSourceState.Valid],
    ]);
  });

  it('gives a changed flag value a higher version in a later synchronizer with the same shared flags', async () => {
    // A first synchronizer loads two values and stops.
    const shared: SharedFileFlags = {};
    filesystem.set(path, document('a'));
    const first = new FileDataSynchronizerFDv2(
      { type: 'file', paths: [path], autoUpdate: true },
      platform,
      logger,
      shared,
    );
    first.start(dataCallback, statusCallback);
    await jest.runAllTimersAsync();
    filesystem.set(path, document('b'));
    filesystem.emit(directory, 'change');
    await jest.runAllTimersAsync();
    first.stop();
    expect(flagIn(dataCallback.mock.calls[1])).toMatchObject({ variations: ['b'], version: 2 });

    // Change the file and load it with a new synchronizer that has the same shared flags.
    filesystem.set(path, document('c'));
    synchronizer = new FileDataSynchronizerFDv2(
      { type: 'file', paths: [path], autoUpdate: true },
      platform,
      logger,
      shared,
    );
    synchronizer.start(dataCallback, statusCallback);
    await jest.runAllTimersAsync();

    // The new value has a version higher than the last version of the first synchronizer.
    expect(dataCallback).toHaveBeenCalledTimes(3);
    expect(flagIn(dataCallback.mock.calls[2])).toMatchObject({ variations: ['c'], version: 3 });
  });

  it('reports no failure when a later synchronizer with the same shared flags finds a file empty that had content', async () => {
    // A first synchronizer loads the file and stops.
    const shared: SharedFileFlags = {};
    filesystem.set(path, document('a'));
    const first = new FileDataSynchronizerFDv2(
      { type: 'file', paths: [path], autoUpdate: true },
      platform,
      logger,
      shared,
    );
    first.start(dataCallback, statusCallback);
    await jest.runAllTimersAsync();
    first.stop();

    // Empty the file as an in-place rewrite does, and start a new synchronizer with the same
    // shared flags.
    filesystem.set(path, '');
    synchronizer = new FileDataSynchronizerFDv2(
      { type: 'file', paths: [path], autoUpdate: true },
      platform,
      logger,
      shared,
    );
    synchronizer.start(dataCallback, statusCallback);
    await jest.advanceTimersByTimeAsync(0);

    // The new synchronizer holds the empty file back. It reports no state and logs no error.
    expect(dataCallback).toHaveBeenCalledTimes(1);
    expect(statusCallback.mock.calls).toEqual([[subsystem.DataSourceState.Valid]]);
    expect(logger.getCount(LogLevel.Error)).toEqual(0);

    // Write the new content and report the change.
    filesystem.set(path, document('b'));
    filesystem.emit(directory, 'change');
    await jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DELAY_MS);

    // The new synchronizer sends the new content and reports the state valid.
    expect(dataCallback).toHaveBeenCalledTimes(2);
    expect(flagIn(dataCallback.mock.calls[1])).toMatchObject({ variations: ['b'], version: 2 });
    expect(statusCallback.mock.calls).toEqual([
      [subsystem.DataSourceState.Valid],
      [subsystem.DataSourceState.Valid],
    ]);
  });

  it('sends no payload when a change notification leaves the file content the same', async () => {
    filesystem.set(path, document('a'));
    start({ autoUpdate: true });
    await jest.runAllTimersAsync();

    // Report a change without a change to the content.
    filesystem.emit(directory, 'change');
    await jest.runAllTimersAsync();

    // Only the first load sent a payload.
    expect(dataCallback).toHaveBeenCalledTimes(1);
  });

  it('keeps the last good data and logs the error when a changed file cannot be parsed', async () => {
    filesystem.set(path, document('a'));
    start({ autoUpdate: true });
    await jest.runAllTimersAsync();

    // Write a file that cannot be parsed and report the change.
    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DELAY_MS);

    // No payload and no state arrive, and the failure is logged at error level.
    expect(dataCallback).toHaveBeenCalledTimes(1);
    expect(statusCallback.mock.calls).toEqual([[subsystem.DataSourceState.Valid]]);
    expect(logger.getCount(LogLevel.Error)).toEqual(1);

    // Correct the file without a change notification.
    filesystem.set(path, document('b'));
    await jest.advanceTimersByTimeAsync(DEFAULT_RETRY_DELAY_MS);

    // The automatic retry sends the corrected data and reports the state valid.
    expect(dataCallback).toHaveBeenCalledTimes(2);
    expect(flagIn(dataCallback.mock.calls[1])).toMatchObject({ variations: ['b'] });
    expect(statusCallback).toHaveBeenLastCalledWith(subsystem.DataSourceState.Valid);
  });

  it('logs a failure that the automatic retries find again at error level one time', async () => {
    filesystem.set(path, document('a'));
    start({ autoUpdate: true });
    await jest.runAllTimersAsync();

    // Write a file that cannot be parsed, report the change, and let three retries run.
    const readsBefore = filesystem.readCount;
    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DELAY_MS + 3 * DEFAULT_RETRY_DELAY_MS);

    // The reload and the three retries read the file. The failure is logged at error level one
    // time. No payload and no state arrive.
    expect(filesystem.readCount - readsBefore).toEqual(4);
    expect(logger.getCount(LogLevel.Error)).toEqual(1);
    expect(dataCallback).toHaveBeenCalledTimes(1);
    expect(statusCallback).toHaveBeenCalledTimes(1);
  });

  it('closes the watch on a deleted directory when a load fails after a good load', async () => {
    filesystem.set(path, document('a'));
    start({ autoUpdate: true });
    await jest.runAllTimersAsync();

    // A file that cannot be parsed arms the retry while the directory still exists.
    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DELAY_MS);
    expect(filesystem.activeWatches(directory)).toHaveLength(1);

    // Delete the directory without a change notification and let the retry fail to read the file.
    filesystem.removeDirectory(directory);
    await jest.advanceTimersByTimeAsync(DEFAULT_RETRY_DELAY_MS);

    // The failed load makes the watcher check its directories, and it closes the watch on the
    // deleted directory. The last good data stays.
    expect(filesystem.activeWatches(directory)).toHaveLength(0);
    expect(dataCallback).toHaveBeenCalledTimes(1);
  });

  it('closes its watches and retries no more after stop when the first load failed', async () => {
    start({ autoUpdate: true });
    await jest.advanceTimersByTimeAsync(0);
    expect(filesystem.activeWatches()).not.toHaveLength(0);

    // Stop the synchronizer and let the time of several retries pass.
    synchronizer!.stop();
    const readsAfterStop = filesystem.readCount;
    await jest.advanceTimersByTimeAsync(5 * DEFAULT_RETRY_DELAY_MS);

    // No watch stays open and no retry reads the file.
    expect(filesystem.activeWatches()).toHaveLength(0);
    expect(filesystem.readCount).toEqual(readsAfterStop);
  });

  it('closes its watches and sends nothing after stop, also for a load in progress', async () => {
    filesystem.set(path, document('a'));
    start({ autoUpdate: true });
    await jest.runAllTimersAsync();

    // Start a reload that waits on the file read.
    filesystem.deferReads = true;
    filesystem.set(path, document('b'));
    filesystem.emit(directory, 'change');
    await jest.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_DELAY_MS);
    expect(filesystem.pendingReads).toHaveLength(1);

    // Stop the synchronizer, then let the read complete.
    synchronizer!.stop();
    filesystem.completePendingReads();
    await jest.runAllTimersAsync();

    // No watch stays open, and only the first load sent a payload and a state.
    expect(filesystem.activeWatches()).toHaveLength(0);
    expect(dataCallback).toHaveBeenCalledTimes(1);
    expect(statusCallback).toHaveBeenCalledTimes(1);
  });
});
