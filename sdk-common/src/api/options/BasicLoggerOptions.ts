import { LDLogLevel } from '../LDLogLevel';

/**
 * Configuration for [[basicLogger]].
 */

export interface BasicLoggerOptions {
  /**
   * The lowest level of log message to enable.
   *
   * See [[LDLogLevel]] for a list of possible levels. Setting a level here causes
   * all lower-importance levels to be disabled: for instance, if you specify
   * `'warn'`, then `'debug'` and `'info'` are disabled.
   *
   * If not specified, the default is `'info'` (meaning that `'debug'` is disabled).
   */
  level?: LDLogLevel;

  /**
   * An optional function to use to print each log line.
   *
   * If this is specified, `basicLogger` calls it to write each line of output. The
   * argument is a fully formatted log line, not including a linefeed. The function
   * is only called for log levels that are enabled.
   *
   * If not specified, the default is `console.error`.
   *
   * Setting this property to anything other than a function will cause SDK
   * initialization to fail.
   */
  destination?: (line: string) => void;
}
