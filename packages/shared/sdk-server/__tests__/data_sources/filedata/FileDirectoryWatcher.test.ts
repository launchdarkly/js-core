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

  // The watcher also watches each configured file directly. These tests are about the directory
  // watches, so the file watches are left out of the counts.
  const directoryWatches = () =>
    filesystem.activeWatches().filter((watch) => !watch.path.endsWith('.json'));

  it('watches the directory of each file once', () => {
    startWatcher(['/a/one.json', '/a/two.json', '/b/three.json']);

    expect(directoryWatches().map((watch) => watch.path)).toEqual(['/a', '/b']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('watches each configured file directly and sets the watch up again after an event', () => {
    // A direct watch follows a symbolic link to a file in another directory, which the directory
    // watch cannot see. It ends when the file is replaced, so it is renewed after each event.
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    const [before] = filesystem.activeWatches('/a/one.json');
    expect(before).toBeDefined();

    filesystem.emit('/a/one.json', 'change');
    expect(onChange).toHaveBeenCalledTimes(1);
    const [after] = filesystem.activeWatches('/a/one.json');
    expect(before.closed).toBe(true);
    expect(after).toBeDefined();
    expect(after).not.toBe(before);

    watcher.close();
    expect(filesystem.activeWatches('/a/one.json')).toHaveLength(0);
  });

  it('reloads and sets the watch up again when a direct file watch reports an error', () => {
    // The file can have changed while its watch was failing, and when the path is a link to a
    // file in another directory, the directory watch does not see that change.
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    const [before] = filesystem.activeWatches('/a/one.json');

    filesystem.emit('/a/one.json', 'error');
    expect(onChange).toHaveBeenCalledTimes(1);
    const [after] = filesystem.activeWatches('/a/one.json');
    expect(before.closed).toBe(true);
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });

  it('invokes the callback for a change in a watched directory', () => {
    startWatcher(['/a/one.json']);

    filesystem.emit('/a', 'rename');
    filesystem.emit('/a', 'change');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores an event that names an entry which is not a configured file', () => {
    startWatcher(['/a/one.json']);

    filesystem.emit('/a', 'change', 'other.json');
    expect(onChange).not.toHaveBeenCalled();
    filesystem.emit('/a', 'change', 'one.json');
    expect(onChange).toHaveBeenCalledTimes(1);
    // Without a name from the platform, every event counts.
    filesystem.emit('/a', 'change');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('runs the callback for an event naming another entry when a configured file changed through it', async () => {
    // A mounted ConfigMap is updated by swapping a symbolic link that the configured file
    // points through. The event names the link, not the file, and the file's metadata changes.
    filesystem.set('/a/one.json', '{}', 1, 2);
    startWatcher(['/a/one.json']);
    await jest.advanceTimersByTimeAsync(0);

    filesystem.set('/a/one.json', '{}', 2, 2);
    filesystem.emit('/a', 'rename', '..data');
    await jest.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalledTimes(1);

    // The same metadata again is not a change.
    filesystem.emit('/a', 'rename', '..data_tmp');
    await jest.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reads the metadata of every configured file in the directory, not only the first', () => {
    startWatcher(['/a/one.json', '/a/two.json']);

    filesystem.emit('/a', 'change', 'two.json');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('still checks the directory on an event for an entry that is not configured', async () => {
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    const [watch] = filesystem.activeWatches('/a');

    filesystem.removeDirectory('/a');
    filesystem.emit('/a', 'rename', 'other.json');
    expect(onChange).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(0);

    expect(watch.closed).toBe(true);
  });

  it('closes the watches and ignores later events', () => {
    startWatcher(['/a/one.json', '/b/two.json']);
    watcher.close();

    expect(directoryWatches()).toHaveLength(0);
    filesystem.watches.forEach((watch) => watch.callback('change', watch.path));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('logs a directory that cannot be watched and retries until it can', async () => {
    filesystem.failingDirectories.add('/b');
    startWatcher(['/a/one.json', '/b/two.json']);

    expect(directoryWatches().map((watch) => watch.path)).toEqual(['/a']);
    logger.expectMessages([{ level: LogLevel.Error, matches: /Unable to watch directory "\/b"/ }]);
    expect(onChange).not.toHaveBeenCalled();

    // The retry fails again while the directory stays unavailable.
    await jest.advanceTimersByTimeAsync(1000);
    expect(directoryWatches().map((watch) => watch.path)).toEqual(['/a']);
    expect(logger.getCount(LogLevel.Error)).toEqual(2);

    // When the retry succeeds, the callback runs once to pick up changes made in the meantime.
    filesystem.failingDirectories.delete('/b');
    await jest.advanceTimersByTimeAsync(1000);
    expect(directoryWatches().map((watch) => watch.path)).toEqual(['/a', '/b']);
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
    expect(directoryWatches()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the watch on a directory that still exists', async () => {
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    const [watch] = filesystem.activeWatches('/a');

    filesystem.emit('/a', 'change');
    watcher.verify();
    await jest.advanceTimersByTimeAsync(0);

    expect(filesystem.activeWatches('/a')).toEqual([watch]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(logger.getCount(LogLevel.Warn)).toEqual(0);
  });

  it('closes the watch on a deleted directory so that a flood of events stops', async () => {
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    const [watch] = filesystem.activeWatches('/a');

    // Some platforms deliver an endless stream of events for a deleted directory. The first
    // ones arrive before the existence check completes.
    filesystem.removeDirectory('/a');
    filesystem.emit('/a', 'rename');
    filesystem.emit('/a', 'rename');
    filesystem.emit('/a', 'rename');
    expect(onChange).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(0);

    // The check finds the directory gone and closes the watch. Events the platform still
    // delivers for it no longer reach the callback.
    expect(watch.closed).toBe(true);
    expect(directoryWatches()).toHaveLength(0);
    logger.expectMessages([
      { level: LogLevel.Warn, matches: /Directory "\/a" no longer exists/ },
      { level: LogLevel.Error, matches: /Unable to watch directory "\/a"/ },
    ]);
    Array.from({ length: 100 }).forEach(() => watch.callback('rename', '/a'));
    expect(onChange).toHaveBeenCalledTimes(3);

    // The watch is set up again once the directory exists, and the callback runs to pick up
    // changes made in the meantime.
    await jest.advanceTimersByTimeAsync(1000);
    expect(directoryWatches()).toHaveLength(0);
    filesystem.restoreDirectory('/a');
    await jest.advanceTimersByTimeAsync(1000);
    expect(directoryWatches().map((active) => active.path)).toEqual(['/a']);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('checks again when an event arrives during a check', async () => {
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    const [watch] = filesystem.activeWatches('/a');

    // The first event starts a check. The second event arrives while it is in progress.
    filesystem.deferStats = true;
    filesystem.emit('/a', 'rename');
    filesystem.emit('/a', 'rename');
    // The directory check is pending once. The files' metadata read is separate.
    const directoryChecks = () => filesystem.pendingStats.filter((lookup) => lookup.path === '/a');
    expect(directoryChecks()).toHaveLength(1);

    // The first check observes the directory before it is deleted, so the watch stays.
    filesystem.completePendingStats();
    await jest.advanceTimersByTimeAsync(0);
    expect(filesystem.activeWatches('/a')).toEqual([watch]);

    // The second event is not lost: a check runs again and observes the deletion.
    expect(directoryChecks()).toHaveLength(1);
    filesystem.removeDirectory('/a');
    filesystem.completePendingStats();
    await jest.advanceTimersByTimeAsync(0);
    expect(watch.closed).toBe(true);
    expect(directoryWatches()).toHaveLength(0);
    expect(filesystem.pendingStats).toHaveLength(0);
  });

  it('checks the directories on request and replaces the watch on a deleted one', async () => {
    filesystem.set('/a/one.json', '{}');
    filesystem.set('/b/two.json', '{}');
    startWatcher(['/a/one.json', '/b/two.json']);
    const [watchA] = filesystem.activeWatches('/a');
    const [watchB] = filesystem.activeWatches('/b');

    // Some platforms deliver no event at all for a deleted directory. The owner asks for a check
    // after a failed load.
    filesystem.removeDirectory('/a');
    watcher.verify();
    await jest.advanceTimersByTimeAsync(0);

    expect(watchA.closed).toBe(true);
    expect(directoryWatches()).toEqual([watchB]);
    expect(onChange).not.toHaveBeenCalled();

    filesystem.restoreDirectory('/a');
    await jest.advanceTimersByTimeAsync(1000);
    expect(directoryWatches().map((active) => active.path)).toEqual(['/b', '/a']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('replaces a watch that reports an error', async () => {
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    const [watch] = filesystem.activeWatches('/a');

    expect(() => filesystem.emit('/a', 'error')).not.toThrow();

    // The failed watch is closed and a new one is in place, so a change made in the meantime
    // is picked up.
    expect(watch.closed).toBe(true);
    expect(directoryWatches().map((active) => active.path)).toEqual(['/a']);
    expect(filesystem.activeWatches('/a')[0]).not.toBe(watch);
    expect(onChange).toHaveBeenCalledTimes(1);
    logger.expectMessages([
      { level: LogLevel.Warn, matches: /The watch on directory "\/a" failed/ },
    ]);
  });

  it('retries a watch that reports an error while its directory is gone', async () => {
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);

    filesystem.removeDirectory('/a');
    filesystem.emit('/a', 'error');
    expect(directoryWatches()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();

    filesystem.restoreDirectory('/a');
    await jest.advanceTimersByTimeAsync(1000);
    expect(directoryWatches().map((active) => active.path)).toEqual(['/a']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// A platform watch on a file that does not exist fails. The shared mock accepts a watch on any
// path, so this variant refuses a watch on a file path that has no file, as the platforms do.
class StrictMockFilesystem extends MockFilesystem {
  override watch(
    path: string,
    callback: (eventType: string, filename: string, changedName?: string) => void,
  ) {
    if (path.endsWith('.json') && !this.files[path]) {
      const err = new Error(`ENOENT: no such file or directory, watch '${path}'`) as Error & {
        code: string;
      };
      err.code = 'ENOENT';
      throw err;
    }
    return super.watch(path, callback);
  }
}

describe('given a directory watcher over a filesystem that refuses a watch on an absent file', () => {
  let filesystem: StrictMockFilesystem;
  let onChange: jest.Mock;
  let watcher: FileDirectoryWatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new StrictMockFilesystem();
    onChange = jest.fn();
  });

  afterEach(() => {
    watcher?.close();
    jest.useRealTimers();
  });

  const startWatcher = (paths: string[]) => {
    watcher = new FileDirectoryWatcher(filesystem, paths, onChange, new TestLogger());
    watcher.start();
    return watcher;
  };

  it('sets the direct file watch up again when a deleted directory is restored with its file', async () => {
    filesystem.set('/a/one.json', '{}');
    startWatcher(['/a/one.json']);
    expect(filesystem.activeWatches('/a/one.json')).toHaveLength(1);

    // The deletion reaches the direct watch, which ends with the file, and the directory watch,
    // whose check finds the directory gone and closes it.
    filesystem.removeDirectory('/a');
    filesystem.emit('/a/one.json', 'rename');
    filesystem.emit('/a', 'rename', 'one.json');
    await jest.advanceTimersByTimeAsync(0);
    expect(filesystem.activeWatches('/a')).toHaveLength(0);
    expect(filesystem.activeWatches('/a/one.json')).toHaveLength(0);

    // The directory comes back with the file in place. The retry restores the directory watch,
    // and the direct watch on the file comes back with it.
    filesystem.set('/a/one.json', '{}');
    await jest.advanceTimersByTimeAsync(1000);
    expect(filesystem.activeWatches('/a')).toHaveLength(1);
    expect(filesystem.activeWatches('/a/one.json')).toHaveLength(1);
  });

  it('sets the direct file watch up when a directory missing at start appears with its file', async () => {
    filesystem.removeDirectory('/a');
    startWatcher(['/a/one.json']);
    expect(filesystem.activeWatches('/a')).toHaveLength(0);
    expect(filesystem.activeWatches('/a/one.json')).toHaveLength(0);

    // The directory appears with the file in place. The retry sets up the directory watch and
    // the direct watch on the file together.
    filesystem.set('/a/one.json', '{}');
    await jest.advanceTimersByTimeAsync(1000);
    expect(filesystem.activeWatches('/a')).toHaveLength(1);
    expect(filesystem.activeWatches('/a/one.json')).toHaveLength(1);
  });
});
