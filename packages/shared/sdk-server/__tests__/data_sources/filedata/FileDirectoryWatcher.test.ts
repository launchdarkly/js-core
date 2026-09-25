import { directoryOf, FileDirectoryWatcher } from '../../../src/data_sources/filedata';
import TestLogger, { LogLevel } from '../../Logger';
import MockFilesystem from './MockFilesystem';

it.each([
  ['/data/one.json', '/data'],
  ['/one.json', '/'],
  ['one.json', '.'],
  ['relative/one.json', 'relative'],
  ['C:\\one.json', 'C:\\'],
  ['C:\\data\\one.json', 'C:\\data'],
])('determines the directory of %s', (path, expected) => {
  expect(directoryOf(path)).toEqual(expected);
});

describe('given a directory watcher over a mock filesystem', () => {
  let filesystem: MockFilesystem;
  let logger: TestLogger;
  let onChange: jest.Mock;
  let watcher: FileDirectoryWatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    logger = new TestLogger();
    onChange = jest.fn();
  });

  afterEach(() => {
    watcher?.close();
    jest.useRealTimers();
  });

  const startWatcher = (paths: string[]) => {
    watcher = new FileDirectoryWatcher(filesystem, paths, onChange, logger);
    watcher.start();
    return watcher;
  };

  it('watches the directory of each file once', () => {
    startWatcher(['/a/one.json', '/a/two.json', '/b/three.json']);

    expect(filesystem.activeWatches().map((watch) => watch.path)).toEqual(['/a', '/b']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('invokes the callback for a change in a watched directory', () => {
    startWatcher(['/a/one.json']);

    filesystem.emit('/a', 'rename');
    filesystem.emit('/a', 'change');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('closes the watches and ignores later events', () => {
    startWatcher(['/a/one.json', '/b/two.json']);
    watcher.close();

    expect(filesystem.activeWatches()).toHaveLength(0);
    filesystem.watches.forEach((watch) => watch.callback('change', watch.path));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('logs a directory that cannot be watched and retries until it can', async () => {
    filesystem.failingDirectories.add('/b');
    startWatcher(['/a/one.json', '/b/two.json']);

    expect(filesystem.activeWatches().map((watch) => watch.path)).toEqual(['/a']);
    logger.expectMessages([{ level: LogLevel.Error, matches: /Unable to watch directory "\/b"/ }]);
    expect(onChange).not.toHaveBeenCalled();

    // The retry fails again while the directory stays unavailable.
    await jest.advanceTimersByTimeAsync(1000);
    expect(filesystem.activeWatches().map((watch) => watch.path)).toEqual(['/a']);
    expect(logger.getCount(LogLevel.Error)).toEqual(2);

    // When the retry succeeds, the callback runs once to pick up changes made in the meantime.
    filesystem.failingDirectories.delete('/b');
    await jest.advanceTimersByTimeAsync(1000);
    expect(filesystem.activeWatches().map((watch) => watch.path)).toEqual(['/a', '/b']);
    expect(onChange).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stops retrying when closed', async () => {
    filesystem.failingDirectories.add('/b');
    startWatcher(['/b/two.json']);
    watcher.close();

    filesystem.failingDirectories.delete('/b');
    await jest.advanceTimersByTimeAsync(5000);
    expect(filesystem.activeWatches()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});
