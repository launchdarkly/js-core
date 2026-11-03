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
   *
   * The data source watches the files for changes. A file that is replaced by a rename, or
   * deleted and created again, is picked up, and so is an update of a mounted Kubernetes
   * ConfigMap or Secret, which swaps a symbolic link. A file or directory that cannot be watched
   * yet, for example because it does not exist, is still noticed: its changes are picked up once
   * it can be watched.
   *
   * Files can be rewritten in place. If the data source reads a file while it is being written, or
   * a file cannot be parsed, it keeps the flags it has and reads the file again shortly afterward.
   * For a YAML file, replacing its contents in one operation, such as by renaming a fully written
   * temporary file over it, avoids briefly loading a partly written file.
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
