import { Filesystem, WatchHandle } from '@launchdarkly/js-sdk-common';

/**
 * A debounced file load/watcher for use with the {@link FileDataSource}.
 *
 * The file loader will load all files specified and keep the string representations in memory.
 * Whenever a change is made to any of the files, then that file will be reloaded and the in
 * memory version updated.
 *
 * Updates to many files, which occur within 10ms of each other, will be coalesced into
 * a single callback.
 *
 * @internal
 */
export default class FileLoader {
  private _watchers: WatchHandle[] = [];

  private _fileData: Record<string, string> = {};

  private _fileTimestamps: Record<string, number> = {};

  private _debounceHandle: any;

  constructor(
    private readonly _filesystem: Filesystem,
    private readonly _paths: string[],
    private readonly _watch: boolean,
    private readonly _callback: (results: { path: string; data: string }[]) => void,
  ) {}

  /**
   * Load all the files and start watching them if watching is enabled.
   */
  async loadAndWatch() {
    const promises = this._paths.map(async (path) => {
      const data = await this._filesystem.readFile(path);
      const timeStamp = await this._filesystem.getFileTimestamp(path);
      return { data, path, timeStamp };
    });
    // This promise could be rejected, let the caller handle it.
    const results = await Promise.all(promises);
    results.forEach((res) => {
      this._fileData[res.path] = res.data;
      this._fileTimestamps[res.path] = res.timeStamp;
    });
    this._callback(results);

    // If we are watching, then setup watchers and notify of any changes.
    if (this._watch) {
      this._paths.forEach((path) => {
        const watcher = this._filesystem.watch(path, async (_: string, updatePath: string) => {
          const timeStamp = await this._filesystem.getFileTimestamp(updatePath);
          // The modification time is the same, so we are going to ignore this update.
          // In some implementations watch might be triggered multiple times for a single update.
          if (timeStamp === this._fileTimestamps[updatePath]) {
            return;
          }
          this._fileTimestamps[updatePath] = timeStamp;
          const data = await this._filesystem.readFile(updatePath);
          this._fileData[updatePath] = data;
          this._debounceCallback();
        });
        this._watchers.push(watcher);
      });
    }
  }

  close() {
    this._watchers.forEach((watcher) => watcher.close());
  }

  private _debounceCallback() {
    // If there is a handle, then we have already started the debounce process.
    if (!this._debounceHandle) {
      this._debounceHandle = setTimeout(() => {
        this._debounceHandle = undefined;
        this._callback(
          Object.entries(this._fileData).reduce(
            (acc: { path: string; data: string }[], [path, data]) => {
              acc.push({ path, data });
              return acc;
            },
            [],
          ),
        );
      }, 10);
      // The 10ms delay above is arbitrary - we just don't want to have the number be zero,
      // because in a case where multiple watch events are fired off one after another,
      // we want the reload to happen only after all of the event handlers have executed.
    }
  }
}
