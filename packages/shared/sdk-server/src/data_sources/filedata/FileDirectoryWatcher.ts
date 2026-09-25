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
 * Watches the directories that contain the given files, and invokes the change callback on
 * any change in them. Watching the directory rather than the file means that a file which
 * does not exist yet is detected when it appears, and that a file replaced by a rename does
 * not lose its watch.
 *
 * The callback can run for changes to other files in the same directory. Feed it into a
 * {@link FileReloader}, whose debouncing and skip-unchanged handling absorb the excess.
 *
 * A directory that cannot be watched is logged and attempted again after a delay. When a
 * retry succeeds, the callback runs once so that changes made in the meantime are picked up.
 *
 * @internal
 */
export default class FileDirectoryWatcher {
  private readonly _directories: string[];

  private readonly _handles: Record<string, WatchHandle> = {};

  private _retryTimer?: ReturnType<typeof setTimeout>;

  private _closed = false;

  constructor(
    private readonly _filesystem: Filesystem,
    paths: string[],
    private readonly _onChange: () => void,
    private readonly _logger?: LDLogger,
  ) {
    this._directories = Array.from(new Set(paths.map(directoryOf)));
  }

  /**
   * Sets up the watches. Returns after the first attempt. Failures are retried in the
   * background.
   */
  start(): void {
    this._setupWatches(false);
  }

  close(): void {
    this._closed = true;
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = undefined;
    }
    Object.values(this._handles).forEach((handle) => handle.close());
  }

  private _setupWatches(isRetry: boolean): void {
    if (this._closed) {
      return;
    }
    let failed = false;
    this._directories.forEach((directory) => {
      if (this._handles[directory]) {
        return;
      }
      try {
        this._handles[directory] = this._filesystem.watch(directory, () => {
          if (!this._closed) {
            this._onChange();
          }
        });
      } catch (err) {
        failed = true;
        this._logger?.error(
          `Unable to watch directory "${directory}": ${err instanceof Error ? err.message : err}`,
        );
      }
    });
    if (failed) {
      this._retryTimer = setTimeout(() => {
        this._retryTimer = undefined;
        this._setupWatches(true);
      }, WATCH_RETRY_DELAY_MS);
      return;
    }
    if (isRetry) {
      // Changes could have happened while the watch was not in place.
      this._onChange();
    }
  }
}
