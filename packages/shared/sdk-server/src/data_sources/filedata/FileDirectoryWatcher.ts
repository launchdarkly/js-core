import { Filesystem, LDLogger, WatchHandle } from '@launchdarkly/js-sdk-common';

/**
 * The delay before a failed watch setup is attempted again.
 */
const WATCH_RETRY_DELAY_MS = 1000;

/**
 * Returns the directory part of a path. The shared code has no platform path module, so this
 * handles both separators.
 */
export function directoryOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (index < 0) {
    return '.';
  }
  if (index === 0) {
    return path.substring(0, 1);
  }
  const directory = path.substring(0, index);
  // A Windows drive root keeps its separator.
  return /^[a-zA-Z]:$/.test(directory) ? `${directory}\\` : directory;
}

/**
 * Returns the file name part of a path, handling both separators.
 */
export function basenameOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index < 0 ? path : path.substring(index + 1);
}

async function directoryExists(filesystem: Filesystem, directory: string): Promise<boolean> {
  try {
    if (filesystem.getFileStats) {
      return (await filesystem.getFileStats(directory)) !== undefined;
    }
    await filesystem.getFileTimestamp(directory);
    return true;
  } catch {
    return false;
  }
}

/**
 * One watch on a directory. The flag marks a watch that the owner has closed, so that events the
 * platform still delivers for it are ignored.
 */
class DirectoryWatch {
  public closed = false;

  public readonly handle: WatchHandle;

  constructor(
    filesystem: Filesystem,
    directory: string,
    onEvent: (watch: DirectoryWatch, eventType: string, changedName?: string) => void,
  ) {
    this.handle = filesystem.watch(directory, (eventType, _watched, changedName) =>
      onEvent(this, eventType, changedName),
    );
  }
}

/**
 * Watches the directories that contain the given files, and invokes the change callback on
 * any change in them. Watching the directory rather than the file means that a file which
 * does not exist yet is detected when it appears, and that a file replaced by a rename does
 * not lose its watch.
 *
 * An event that names an entry which is not one of the configured files runs the callback only
 * when the metadata of a configured file in that directory changed. The metadata is read through
 * any symbolic link, so a link swap that replaces a configured file's target without naming the
 * link, which is how a mounted ConfigMap is updated, is detected, while a busy sibling file costs
 * no reload. When the platform does not report which entry changed, every event in the directory
 * runs the callback. Feed it into a {@link FileReloader}, whose debouncing and skip-unchanged
 * handling absorb the excess.
 *
 * Each configured file is also watched directly. A watch on a file follows a symbolic link to its
 * target, so a configured path that links to a file in another directory is detected when that
 * file changes, as a watch on the path alone always did. A watch on a file ends when the file is
 * replaced, so after each event the watch is set up again, on whatever the path names now.
 *
 * A directory that cannot be watched is logged and attempted again after a delay. A watch on a
 * directory that is deleted goes dead on some platforms and floods events on others, so after
 * each event, after a watch error, and on request after a failed load, the watcher checks that
 * the directory still exists. A directory that no longer exists has its watch closed and set up
 * again once it exists, through the same retry. When a retry succeeds, the callback runs once so
 * that changes made in the meantime are picked up.
 *
 * @internal
 */
export default class FileDirectoryWatcher {
  private readonly _directories: string[];

  private readonly _watches: Record<string, DirectoryWatch> = {};

  // The configured file names in each directory. An event for one of them always counts.
  private readonly _names: Record<string, Set<string>> = {};

  // The configured files in each directory, and the last observed metadata of each, read through
  // any symbolic link. An event for another entry counts when this metadata changed.
  private readonly _files: Record<string, string[]> = {};

  private readonly _signatures: Record<string, string> = {};

  // The directories whose files' metadata is being read. The flag records that a check was
  // requested during the read, so that it runs again afterwards.
  private readonly _fileChecks: Record<string, { again: boolean; notify: boolean }> = {};

  // The configured paths, and the direct watch on each that currently exists.
  private readonly _paths: string[];

  private readonly _fileWatches: Record<string, WatchHandle> = {};

  // The directories whose existence is being checked. The flag records that an event arrived
  // during the check, so that the check runs again and observes the state after that event.
  private readonly _checks: Record<string, { again: boolean }> = {};

  private _retryTimer?: ReturnType<typeof setTimeout>;

  private _closed = false;

  constructor(
    private readonly _filesystem: Filesystem,
    paths: string[],
    private readonly _onChange: () => void,
    private readonly _logger?: LDLogger,
  ) {
    this._paths = Array.from(new Set(paths));
    this._directories = Array.from(new Set(paths.map(directoryOf)));
    paths.forEach((path) => {
      const directory = directoryOf(path);
      this._names[directory] = this._names[directory] ?? new Set();
      this._names[directory].add(basenameOf(path));
      this._files[directory] = this._files[directory] ?? [];
      this._files[directory].push(path);
    });
  }

  /**
   * Sets up the watches. Returns after the first attempt. Failures are retried in the
   * background.
   */
  start(): void {
    this._setupWatches(false);
    this._armFileWatches();
    // Record the files' metadata, so that a later event for another entry can be compared to it.
    this._directories.forEach((directory) => this._checkFiles(directory, false));
  }

  close(): void {
    this._closed = true;
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = undefined;
    }
    Object.keys(this._watches).forEach((directory) => this._dropWatch(directory));
    Object.keys(this._fileWatches).forEach((path) => this._dropFileWatch(path));
  }

  /**
   * Checks that every watched directory still exists. A directory that does not exist has its
   * watch closed and set up again once it exists. Call it after a failed load, because a load
   * that fails to read a file can mean that the file's directory is gone.
   */
  verify(): void {
    this._directories.forEach((directory) => this._checkDirectory(directory));
    // A file that did not exist when its watch was last attempted may exist now.
    this._armFileWatches();
  }

  /**
   * Sets up a direct watch on each configured file that has none. A file that cannot be watched,
   * usually because it does not exist yet, is attempted again at the next event or verify call.
   */
  private _armFileWatches(): void {
    if (this._closed) {
      return;
    }
    this._paths.forEach((path) => this._armFileWatch(path));
  }

  private _armFileWatch(path: string): void {
    if (this._closed || this._fileWatches[path]) {
      return;
    }
    try {
      this._fileWatches[path] = this._filesystem.watch(path, () => this._handleFileEvent(path));
    } catch {
      // The directory watch reports the file when it appears, and the watch is attempted again.
    }
  }

  private _dropFileWatch(path: string): void {
    const handle = this._fileWatches[path];
    if (!handle) {
      return;
    }
    delete this._fileWatches[path];
    handle.close();
  }

  /**
   * Sets the direct watch on a configured file up again. A direct watch follows the path to the
   * inode it names when the watch is set up. After the path was replaced or its link retargeted,
   * the watch is on an inode that the path no longer names, and edits to the new target are
   * invisible to it and to the directory watch alike.
   */
  private _renewFileWatch(path: string): void {
    this._dropFileWatch(path);
    this._armFileWatch(path);
  }

  /**
   * An event from the direct watch on a configured file. The file or the target of its link
   * changed, so the callback runs. The watch may now be on an inode that the path no longer
   * names, so it is set up again. An error from the watch is treated the same way: the watch
   * cannot be trusted anymore, and the file can have changed while it was failing, which the
   * directory watch does not see when the path is a link to a file elsewhere.
   */
  private _handleFileEvent(path: string): void {
    if (this._closed || !this._fileWatches[path]) {
      return;
    }
    this._renewFileWatch(path);
    this._onChange();
    this._checkFiles(directoryOf(path), false);
  }

  private _setupWatches(isRetry: boolean): void {
    if (this._closed) {
      return;
    }
    const added: string[] = [];
    let failed = false;
    this._directories.forEach((directory) => {
      if (this._watches[directory]) {
        return;
      }
      try {
        this._watches[directory] = new DirectoryWatch(
          this._filesystem,
          directory,
          (watch, eventType, changedName) =>
            this._handleEvent(watch, directory, eventType, changedName),
        );
        added.push(directory);
      } catch (err) {
        failed = true;
        this._logger?.error(
          `Unable to watch directory "${directory}": ${err instanceof Error ? err.message : err}`,
        );
      }
    });
    if (failed) {
      this._scheduleSetup();
    }
    if (isRetry && added.length > 0) {
      // Changes could have happened in a directory while its watch was not in place. The
      // catch-up runs for every directory watched in this pass, whether or not another
      // directory still cannot be watched: that one gets its own catch-up when it can be.
      this._onChange();
      added.forEach((directory) => this._checkFiles(directory, false));
      // The direct watch on a file in the directory ended with it, or never existed when the
      // directory was missing at start. It is set up again with the directory watch.
      this._armFileWatches();
    }
  }

  private _scheduleSetup(): void {
    if (this._closed || this._retryTimer) {
      return;
    }
    this._retryTimer = setTimeout(() => {
      this._retryTimer = undefined;
      this._setupWatches(true);
    }, WATCH_RETRY_DELAY_MS);
  }

  private _handleEvent(
    watch: DirectoryWatch,
    directory: string,
    eventType: string,
    changedName?: string,
  ): void {
    if (this._closed || watch.closed) {
      return;
    }
    if (eventType === 'error') {
      // The platform reported that the watch itself failed. It cannot be trusted anymore.
      this._logger?.warn(`The watch on directory "${directory}" failed. Setting it up again.`);
      this._replaceWatch(directory);
      return;
    }
    if (changedName === undefined || this._names[directory].has(changedName)) {
      this._onChange();
      // Keep the metadata current, so that a later event for another entry is compared to the
      // state after this change.
      this._checkFiles(directory, false);
      // The file may have appeared, been replaced, or had its link retargeted, so its direct
      // watch is set up again; the others are set up if they are missing.
      this._files[directory]
        .filter((path) => changedName === undefined || basenameOf(path) === changedName)
        .forEach((path) => this._renewFileWatch(path));
      this._armFileWatches();
    } else {
      // Another entry changed. A configured file that is a symbolic link can have changed with
      // it. Its metadata decides.
      this._checkFiles(directory, true);
    }
    // The directory itself may be gone. Check on every event, whatever entry it names.
    this._checkDirectory(directory);
  }

  /**
   * Reads the metadata of the configured files in a directory and remembers it. When `notify` is
   * set and any file's metadata differs from the last observation, the change callback runs, and
   * the direct watch on each changed file is set up again, because its link can point elsewhere
   * now. Reads for one directory do not overlap. A read requested during a read runs afterwards.
   * A request to notify that arrives during a read applies to that read's result as well, since
   * the read may already have observed the change the request is about; when the read is the
   * first observation, which has nothing to compare to, such a request counts as a change.
   */
  private _checkFiles(directory: string, notify: boolean): void {
    if (this._closed || !this._filesystem.getFileStats) {
      return;
    }
    const pending = this._fileChecks[directory];
    if (pending) {
      pending.again = true;
      pending.notify = pending.notify || notify;
      return;
    }
    const check = { again: false, notify: false };
    this._fileChecks[directory] = check;
    const { getFileStats } = this._filesystem;
    const files = this._files[directory];
    Promise.all(
      files.map(async (path) => {
        try {
          const stats = await getFileStats.call(this._filesystem, path);
          return stats ? `${stats.timestamp}:${stats.size}` : 'absent';
        } catch {
          return 'error';
        }
      }),
    ).then((signatures) => {
      delete this._fileChecks[directory];
      if (this._closed) {
        return;
      }
      let changed = false;
      let firstObservation = false;
      files.forEach((path, index) => {
        if (this._signatures[path] !== signatures[index]) {
          if (this._signatures[path] !== undefined) {
            changed = true;
            this._renewFileWatch(path);
          } else {
            firstObservation = true;
          }
          this._signatures[path] = signatures[index];
        }
      });
      if ((notify || check.notify) && (changed || (check.notify && firstObservation))) {
        this._onChange();
      }
      if (check.again) {
        this._checkFiles(directory, check.notify);
      }
    });
  }

  /**
   * Closes and drops the watch on a directory that no longer exists, and sets it up again once
   * the directory exists. Closing the watch is what ends the flood of events that some
   * platforms deliver for a deleted directory.
   */
  private _checkDirectory(directory: string): void {
    if (this._closed || !this._watches[directory]) {
      return;
    }
    const pending = this._checks[directory];
    if (pending) {
      pending.again = true;
      return;
    }
    const check = { again: false };
    this._checks[directory] = check;
    directoryExists(this._filesystem, directory).then((exists) => {
      delete this._checks[directory];
      if (this._closed || !this._watches[directory]) {
        return;
      }
      if (exists) {
        if (check.again) {
          // The deletion of a file and of its directory arrive as separate events. The check
          // for the first can complete before the second happens.
          this._checkDirectory(directory);
        }
        return;
      }
      this._logger?.warn(
        `Directory "${directory}" no longer exists. Its watch is set up again when it appears.`,
      );
      this._replaceWatch(directory);
    });
  }

  private _replaceWatch(directory: string): void {
    this._dropWatch(directory);
    // The setup fails until the directory exists again, and the retry keeps trying.
    this._setupWatches(true);
  }

  private _dropWatch(directory: string): void {
    const watch = this._watches[directory];
    if (!watch) {
      return;
    }
    watch.closed = true;
    delete this._watches[directory];
    watch.handle.close();
  }
}
