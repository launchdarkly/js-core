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
  private watchers: WatchHandle[] = [];

  private fileData: Record<string, string> = {};

  private fileTimestamps: Record<string, number> = {};

  private debounceHandle: any;

  constructor(
    private readonly filesystem: Filesystem,
    private readonly paths: string[],
    private readonly watch: boolean,
    private readonly callback: (results: { path: string; data: string; }[]) => void,
  ) {
  }

  /**
   * Load all the files and start watching them if watching is enabled.
   */
  async loadAndWatch() {
    const promises = this.paths.map(async (path) => {
      const data = await this.filesystem.readFile(path);
      const timeStamp = await this.filesystem.getFileTimestamp(path);
      return { data, path, timeStamp };
    });
    // This promise could be rejected, let the caller handle it.
    const results = await Promise.all(promises);
    results.forEach((res) => {
      this.fileData[res.path] = res.data;
      this.fileTimestamps[res.path] = res.timeStamp;
    });
    this.callback(results);

    // If we are watching, then setup watchers and notify of any changes.
    if (this.watch) {
      this.paths.forEach((path) => {
        const watcher = this.filesystem.watch(path, async (_, updatePath) => {
          const timeStamp = await this.filesystem.getFileTimestamp(updatePath);
          // The modification time is the same, so we are going to ignore this update.
          // In some implementations watch might be triggered multiple times for a single update.
          if (timeStamp === this.fileTimestamps[updatePath]) {
            return;
          }
          this.fileTimestamps[updatePath] = timeStamp;
          const data = await this.filesystem.readFile(updatePath);
          this.fileData[updatePath] = data;
          this.debounceCallback();
        });
        this.watchers.push(watcher);
      });
    }
  }

  close() {
    this.watchers.forEach((watcher) => watcher.close());
  }

  private debounceCallback() {
    // If there is a handle, then we have already started the debounce process.
    if (!this.debounceHandle) {
      this.debounceHandle = setTimeout(() => {
        this.debounceHandle = undefined;
        this.callback(Object.entries(this.fileData)
          .reduce((acc: { path: string; data: string; }[], [path, data]) => {
            acc.push({ path, data });
            return acc;
          }, []));
      }, 10);
      // The 10ms delay above is arbitrary - we just don't want to have the number be zero,
      // because in a case where multiple watch events are fired off one after another,
      // we want the reload to happen only after all of the event handlers have executed.
    }
  }
}
