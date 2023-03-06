export interface WatchHandle {
  /**
   * Stop watching.
   */
  close(): void;
}

/**
 * Interface for doing filesystem operations on the platform.
 */
export interface Filesystem {
  /**
   * The time, in ms since POSIX epoch, that the file was last modified.
   * @param path The path to get a timestamp for.
   *
   * @returns A promise which will resolve to a timestamp if successful, or be
   * rejected if the operation fails.
   */
  getFileTimestamp(path: string): Promise<number>

  /**
   * Read a file into a utf8 encoded string.
   * @param path The path of the file to read.
   *
   * @returns A promise which will resolve to utf8 encoded file content, or be
   * rejected if the operation fails.
   */
  readFile(path: string): Promise<string>

  /**
   * Watch for changes to the specified path.
   *
   * The implementation of this methods should be non-persistent. Meaning that
   * it should not keep the containing process running as long as it is
   * executing. For node this means setting the persistent option to false.
   *
   * @param path The path to watch.
   *
   * @returns An async iterator that watches for changes to `path`.
   */
  watch(path: string, callback: (eventType: string, filename: string) => void): WatchHandle;
}
