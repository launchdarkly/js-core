import { ClientContext, sleep } from '@launchdarkly/js-sdk-common';

import { FileDataSourceFactory } from '../../src/integrations';
import Configuration from '../../src/options/Configuration';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import { createBasicPlatform } from '../createBasicPlatform';
import TestLogger, { LogLevel } from '../Logger';
import waitFor from '../waitFor';
import MockFilesystem from './filedata/MockFilesystem';

// These tests run on real timers. The source waits for change notifications to settle for
// 100 ms and retries a failed load after one second.

const directory = '/data';
const path = `${directory}/flags.json`;
const document = (value: string) => JSON.stringify({ flagValues: { flag: value } });

describe('given a file data source with automatic updates over a mock filesystem', () => {
  let filesystem: MockFilesystem;
  let featureStore: InMemoryFeatureStore;
  let asyncFeatureStore: AsyncStoreFacade;
  let logger: TestLogger;
  let errorHandler: jest.Mock;
  let initSuccessHandler: jest.Mock;
  let source: ReturnType<FileDataSourceFactory['create']> | undefined;

  beforeEach(() => {
    filesystem = new MockFilesystem();
    featureStore = new InMemoryFeatureStore();
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
    logger = new TestLogger();
    errorHandler = jest.fn();
    initSuccessHandler = jest.fn();
  });

  afterEach(() => {
    source?.close();
    source = undefined;
  });

  const start = () => {
    source = new FileDataSourceFactory({ paths: [path], autoUpdate: true }).create(
      new ClientContext('', new Configuration({ featureStore, logger }), {
        ...createBasicPlatform(),
        fileSystem: filesystem,
      }),
      featureStore,
      initSuccessHandler,
      errorHandler,
    );
    source.start();
  };

  const flagValue = async () =>
    (await asyncFeatureStore.get(VersionedDataKinds.Features, 'flag'))?.variations[0];
  const flagVersion = async () =>
    (await asyncFeatureStore.get(VersionedDataKinds.Features, 'flag'))?.version;
  const valueIs = (value: string) => async () => (await flagValue()) === value;

  it('does not leave an unhandled rejection when a file disappears during a reload', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      filesystem.set(path, document('a'));
      start();
      await waitFor(valueIs('a'));

      // The file is removed and the directory reports it. The reload fails to read the file.
      filesystem.remove(path);
      filesystem.emit(directory, 'rename');
      await waitFor(async () => errorHandler.mock.calls.length > 0);
      expect(errorHandler.mock.calls[0][0].message).toMatch(/ENOENT/);
      expect(await flagValue()).toEqual('a');

      // The file comes back without a notification. The retry loads it.
      filesystem.set(path, document('b'));
      await waitFor(valueIs('b'));

      await sleep(50);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('detects a file that is replaced by a rename', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));

    // A rename-based write replaces the file. The directory reports a rename, not a change
    // to the watched file.
    filesystem.set(path, document('b'));
    filesystem.emit(directory, 'rename');

    await waitFor(valueIs('b'));
  });

  it('retries a failed reload and recovers without another change notification', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));

    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await waitFor(async () => errorHandler.mock.calls.length > 0);
    expect(errorHandler.mock.calls[0][0].message).toMatch(/json/i);
    // The last good data stays in effect.
    expect(await flagValue()).toEqual('a');

    // The file is fixed with no further notification. Only the retry can observe it.
    filesystem.set(path, document('b'));
    await waitFor(valueIs('b'));
    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  it('reports every failed edit, not only the first', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));

    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await waitFor(async () => errorHandler.mock.calls.length === 1);

    // A second edit that still fails is reported again. Only automatic retries are demoted.
    filesystem.set(path, '{"flagValues": ');
    filesystem.emit(directory, 'change');
    await waitFor(async () => errorHandler.mock.calls.length === 2);
    expect(errorHandler).toHaveBeenCalledTimes(2);
  });

  it('keeps the version baseline intact across a failed reload', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));
    expect(await flagVersion()).toEqual(1);

    filesystem.set(path, document('b'));
    filesystem.emit(directory, 'change');
    await waitFor(valueIs('b'));
    expect(await flagVersion()).toEqual(2);

    // A malformed edit fails the reload. The internal state of the last good load is intact.
    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await waitFor(async () => errorHandler.mock.calls.length > 0);

    // The next value change continues the version sequence from the last good load.
    filesystem.set(path, document('c'));
    filesystem.emit(directory, 'change');
    await waitFor(valueIs('c'));
    expect(await flagVersion()).toEqual(3);
  });

  it('waits for change notifications to settle before reloading', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));
    const init = jest.spyOn(featureStore, 'init');

    // Five edits arrive closer together than the settle window.
    await ['b', 'c', 'd', 'e', 'f'].reduce<Promise<void>>(
      (previous, value) =>
        previous.then(async () => {
          filesystem.set(path, document(value));
          filesystem.emit(directory, 'change');
          await sleep(20);
        }),
      Promise.resolve(),
    );

    await waitFor(valueIs('f'));
    await sleep(150);
    // One reload for the whole burst.
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('reports a file that is missing at start and loads it when it appears', async () => {
    start();

    await waitFor(async () => errorHandler.mock.calls.length > 0);
    expect(errorHandler.mock.calls[0][0].message).toMatch(/ENOENT/);
    expect(initSuccessHandler).not.toHaveBeenCalled();
    expect(await asyncFeatureStore.initialized()).toBe(false);

    // The file appears without a notification. The retry loads it and the source initializes.
    filesystem.set(path, document('a'));
    await waitFor(valueIs('a'));
    expect(initSuccessHandler).toHaveBeenCalledTimes(1);
  });

  it('reports a file that is written slowly once', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));

    // Each retry sees more of the file and fails to parse it at a different position.
    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await waitFor(async () => errorHandler.mock.calls.length > 0);
    filesystem.set(path, '{"flagValues": {"flag": "b');
    await waitFor(async () => logger.getCount(LogLevel.Debug) > 0);
    filesystem.set(path, '{"flagValues": {"flag": "b"}, "flags": {');
    await waitFor(async () => logger.getCount(LogLevel.Debug) > 1);

    // One report through the error handler and one error-level log for the whole write.
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(logger.getCount(LogLevel.Error)).toEqual(1);
    expect(await flagValue()).toEqual('a');

    filesystem.set(path, document('b'));
    await waitFor(valueIs('b'));

    // A failure of another kind is reported again.
    filesystem.remove(path);
    filesystem.emit(directory, 'rename');
    await waitFor(async () => errorHandler.mock.calls.length > 1);
    expect(errorHandler.mock.calls[1][0].message).toMatch(/ENOENT/);
    expect(logger.getCount(LogLevel.Error)).toEqual(2);
  });

  it('watches the directory again after it is deleted and recreated', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));

    // The directory is deleted. The platform delivers one last event for it, and the reload
    // fails to read the file. The watch on the deleted directory is closed.
    filesystem.removeDirectory(directory);
    filesystem.emit(directory, 'rename');
    await waitFor(async () => errorHandler.mock.calls.length > 0);
    await waitFor(async () => filesystem.activeWatches(directory).length === 0);
    expect(await flagValue()).toEqual('a');

    // The directory is created again with the file in it. The watch is set up again and the
    // file is loaded.
    filesystem.set(path, document('b'));
    await waitFor(valueIs('b'));
    await waitFor(async () => filesystem.activeWatches(directory).length === 1);

    // A later edit is detected through the new watch.
    filesystem.set(path, document('c'));
    filesystem.emit(directory, 'change');
    await waitFor(valueIs('c'));
  });

  it('closes the watch on a deleted directory when a load fails without an event', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));

    // A malformed edit arms the retry while the directory still exists.
    filesystem.set(path, '{"flagValues"');
    filesystem.emit(directory, 'change');
    await waitFor(async () => errorHandler.mock.calls.length > 0);
    expect(filesystem.activeWatches(directory)).toHaveLength(1);

    // The directory is deleted and the platform delivers no event for it. The retry fails to
    // read the file, and the failed load makes the watcher check its directories.
    filesystem.removeDirectory(directory);
    await waitFor(async () => filesystem.activeWatches(directory).length === 0, 3000);
    expect(await flagValue()).toEqual('a');

    filesystem.set(path, document('b'));
    await waitFor(valueIs('b'));
    await waitFor(async () => filesystem.activeWatches(directory).length === 1);
    filesystem.set(path, document('c'));
    filesystem.emit(directory, 'change');
    await waitFor(valueIs('c'));
  });

  it('reloads under a flood of events for a deleted directory', async () => {
    filesystem.set(path, document('a'));
    start();
    await waitFor(valueIs('a'));

    // Some platforms deliver an endless stream of events for a deleted directory, faster than
    // the settle window. The stream ends when the watch is closed.
    filesystem.removeDirectory(directory);
    let events = 0;
    const flood = setInterval(() => {
      filesystem.emit(directory, 'rename');
      events += 1;
    }, 1);
    try {
      await waitFor(async () => errorHandler.mock.calls.length > 0, 2000);
      expect(errorHandler.mock.calls[0][0].message).toMatch(/ENOENT/);
      await waitFor(async () => filesystem.activeWatches(directory).length === 0);
      expect(events).toBeGreaterThan(0);
      expect(await flagValue()).toEqual('a');
    } finally {
      clearInterval(flood);
    }

    filesystem.set(path, document('b'));
    await waitFor(valueIs('b'));
  });
});
