/**
 * The LaunchDarkly client logger interface.
 *
 * The [[LDOptions.logger]] property accepts any object that conforms to this
 * interface. The SDK only uses four logging levels: `error`, `warn`, `info`, and
 * `debug`. It will call the corresponding method of the `LDLogger` either with a
 * single string argument, or with a format string and variable arguments in the
 * format used by Node's `util.format()`.
 *
 * The [Winston](https://github.com/winstonjs/winston) logging package provides a
 * logger that conforms to this interface, so if you have created a logger with
 * Winston, you can simply put it into the [[LDOptions.logger]] property.
 *
 * If you do not provide a logger object, the SDK uses the [[basicLogger]]
 * implementation with a minimum level of `info`.
 */

export interface LDLogger {
  /**
   * The error logger.
   *
   * @param args
   *   A sequence of any JavaScript values.
   */
  error(...args: any[]): void;

  /**
   * The warning logger.
   *
   * @param args
   *   A sequence of any JavaScript values.
   */
  warn(...args: any[]): void;

  /**
   * The info logger.
   *
   * @param args
   *   A sequence of any JavaScript values.
   */
  info(...args: any[]): void;

  /**
   * The debug logger.
   *
   * @param args
   *   A sequence of any JavaScript values.
   */
  debug(...args: any[]): void;
}
