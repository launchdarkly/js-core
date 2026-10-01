import { LDLogger } from '@launchdarkly/js-sdk-common';

/**
 * Configuration for {@link FileDataSource}.
 */
export interface FileDataSourceOptions {
  /**
   * The path(s) of the file(s) that FileDataSource will read.
   */
  paths: Array<string>;

  /**
   * True if FileDataSource should reload flags whenever one of the data files is modified.
   * This feature uses Node's `fs.watch()` API on the directories that contain the files, so it
   * is subject to the limitations described
   * [here](https://nodejs.org/docs/latest/api/fs.html#fs_fs_watch_filename_options_listener).
   * A file that is replaced by a rename, or deleted and created again, is detected. A load
   * that fails, for example because a file was read while it was written, is retried after a
   * short delay and the previously loaded data stays in effect until it succeeds.
   * A change to another entry in a directory causes a reload only when the metadata of a
   * configured file changed, read through any symbolic link, which is how a mounted ConfigMap
   * or Secret is updated.
   * Each configured file is also watched directly, so a path that is a symbolic link to a file
   * in another directory is followed, and that watch is set up again after each change so it
   * survives the file being replaced.
   */
  autoUpdate?: boolean;

  /**
   * Configures a logger for warnings and errors. This can be a custom logger or an instance of.
   * By default, it uses the same logger as the rest of the SDK.
   */
  logger?: LDLogger;

  /**
   * The SDK can support yaml if provided with a parser. The parser must output
   * objects which are equivalent to the standard JSON parser. The parser of the
   * `yaml` package can be used.
   */
  yamlParser?: (data: string) => any;
}
