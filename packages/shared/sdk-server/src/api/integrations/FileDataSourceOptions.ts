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
   * This feature uses Node's `fs.watch()` API, so it is subject to
   * the limitations described [here](https://nodejs.org/docs/latest/api/fs.html#fs_fs_watch_filename_options_listener).
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
