import type { LDLogger } from '../api';
import { TypeValidators } from '../validators';

const loggerRequirements = {
  error: TypeValidators.Function,
  warn: TypeValidators.Function,
  info: TypeValidators.Function,
  debug: TypeValidators.Function,
};

/**
 * The safeLogger logic exists because we allow the application to pass in a custom logger, but
 * there is no guarantee that the logger works correctly and if it ever throws exceptions there
 * could be serious consequences (e.g. an uncaught exception within an error event handler, due
 * to the SDK trying to log the error, can terminate the application). An exception could result
 * from faulty logic in the logger implementation, or it could be that this is not a logger at
 * all but some other kind of object; the former is handled by a catch block that logs an error
 * message to the SDK's default logger, and we can at least partly guard against the latter by
 * checking for the presence of required methods at configuration time.
 */
export default class SafeLogger implements LDLogger {
  private _logger: LDLogger;

  private _fallback: LDLogger;

  /**
   * Construct a safe logger with the specified logger.
   * @param logger The logger to use.
   * @param fallback A fallback logger to use in case an issue is  encountered using
   * the provided logger.
   */
  constructor(logger: LDLogger, fallback: LDLogger) {
    Object.entries(loggerRequirements).forEach(([level, validator]) => {
      if (!validator.is((logger as any)[level])) {
        throw new Error(`Provided logger instance must support logger.${level}(...) method`);
        // Note that the SDK normally does not throw exceptions to the application, but that rule
        // does not apply to LDClient.init() which will throw an exception if the parameters are so
        // invalid that we cannot proceed with creating the client. An invalid logger meets those
        // criteria since the SDK calls the logger during nearly all of its operations.
      }
    });
    this._logger = logger;
    this._fallback = fallback;
  }

  private _log(level: 'error' | 'warn' | 'info' | 'debug', args: any[]) {
    try {
      this._logger[level](...args);
    } catch {
      // If all else fails do not break.
      this._fallback[level](...args);
    }
  }

  error(...args: any[]): void {
    this._log('error', args);
  }

  warn(...args: any[]): void {
    this._log('warn', args);
  }

  info(...args: any[]): void {
    this._log('info', args);
  }

  debug(...args: any[]): void {
    this._log('debug', args);
  }
}
