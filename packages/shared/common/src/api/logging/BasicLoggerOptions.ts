import { LDLogLevel } from './LDLogLevel';

/**
 * Configuration for {@link basicLogger}.
 */
export interface BasicLoggerOptions {
  /**
   * The lowest level of log message to enable.
   *
   * See {@link LDLogLevel} for a list of possible levels. Setting a level here causes
   * all lower-importance levels to be disabled: for instance, if you specify
   * `'warn'`, then `'debug'` and `'info'` are disabled.
   *
   * If not specified, the default is `'info'` (meaning that `'debug'` is disabled).
   */
  level?: LDLogLevel;

  /**
   * Name to use for the log entires. The default name is `LaunchDarkly`.
   */
  name?: string;

  /**
   * An optional function, or map of levels to functions, to use to print each log line.
   *
   * If not specified, the default is `console.error`.
   *
   * If a function is specified, `basicLogger` calls it to write each line of output. The
   * argument is a fully formatted log line, not including a linefeed. The function
   * is only called for log levels that are enabled.
   *
   * If a map is specified, then each entry will be used as the destination for the corresponding
   * log level. Any level that is not specified will use the default of `console.error`.
   *
   * Setting this property to anything other than a function will cause SDK
   * initialization to fail.
   */
  destination?:
    | ((line: string) => void)
    | Record<'debug' | 'info' | 'warn' | 'error', (line: string) => void>;

  /**
   * An optional formatter to use. The formatter should be compatible
   * with node-style format strings like those used with `util.format`.
   *
   * If not specified, then a default implementation will be used.
   * But using a node-specific implementation, for instance, would
   * have performance and quality benefits.
   */
  formatter?: (...args: any[]) => string;
}
