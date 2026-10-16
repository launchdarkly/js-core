import { Filesystem } from '@launchdarkly/js-sdk-common';

/**
 * The observed state of one file, or its absence.
 */
interface FileState {
  exists: boolean;
  timestamp: number;
  size: number;
}

const absent: FileState = { exists: false, timestamp: 0, size: 0 };

async function observe(filesystem: Filesystem, path: string): Promise<FileState> {
  try {
    if (filesystem.getFileStats) {
      const stats = await filesystem.getFileStats(path);
      if (!stats) {
        return absent;
      }
      return { exists: true, timestamp: stats.timestamp, size: stats.size };
    }
    // A platform without file metadata support still reports the modification time. Its
    // absence is reported as a rejection.
    const timestamp = await filesystem.getFileTimestamp(path);
    return { exists: true, timestamp, size: 0 };
  } catch {
    // A file the filesystem cannot examine counts as absent.
    return absent;
  }
}

function observeAll(filesystem: Filesystem, paths: string[]): Promise<FileState[]> {
  return Promise.all(paths.map((path) => observe(filesystem, path)));
}

function sameState(a: FileState, b: FileState): boolean {
  return a.exists === b.exists && a.timestamp === b.timestamp && a.size === b.size;
}

/**
 * Detects changes to a set of files by examining them on a fixed interval. Use it where
 * filesystem change notifications are not available or not reliable. A change to the
 * modification time or the size of any file invokes the change callback. A file that appears
 * or disappears is also a change.
 *
 * The poller samples the files once per interval and compares only the modification time
 * and the size. A rewrite that keeps both values is not detected.
 *
 * Detection is generous. The callback can run for a change that does not alter the effective
 * data. Feed it into a {@link FileReloader}, whose debouncing and skip-unchanged handling absorb
 * the excess.
 *
 * @internal
 */
export default class FilePoller {
  private _last: FileState[] = [];

  private _timer?: ReturnType<typeof setTimeout>;

  private _closed = false;

  constructor(
    private readonly _filesystem: Filesystem,
    private readonly _paths: string[],
    private readonly _intervalMs: number,
    private readonly _onChange: () => void,
  ) {}

  /**
   * Examines the files once and then starts the interval, so only later changes invoke the
   * callback.
   */
  async start(): Promise<void> {
    this._last = await observeAll(this._filesystem, this._paths);
    this._scheduleNext();
  }

  /**
   * Stops the poller. It does not wait for an examination that is in progress. An
   * examination that completes after close does not invoke the callback.
   */
  close(): void {
    this._closed = true;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }

  private _scheduleNext(): void {
    if (this._closed) {
      return;
    }
    this._timer = setTimeout(() => {
      this._timer = undefined;
      this._poll();
    }, this._intervalMs);
  }

  private async _poll(): Promise<void> {
    const current = await observeAll(this._filesystem, this._paths);
    if (this._closed) {
      return;
    }
    const changed = current.some((state, index) => !sameState(state, this._last[index]));
    this._last = current;
    if (changed) {
      this._onChange();
    }
    this._scheduleNext();
  }
}
