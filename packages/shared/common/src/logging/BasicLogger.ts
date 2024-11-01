import { BasicLoggerOptions, LDLogger, LDLogLevel } from '../api';
import format from './format';

enum LogPriority {
  debug = 0,
  info = 1,
  warn = 2,
  error = 3,
  none = 4,
}

const LEVEL_NAMES: LDLogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];

/**
 * A basic logger which handles filtering by level.
 *
 * With the default options it will write to `console.error`
 * and it will use the formatting provided by `console.error`.
 * If the destination is overwritten, then it will use an included
 * formatter similar to `util.format`.
 *
 * If a formatter is available, then that should be overridden
 * as well for performance.
 */
export default class BasicLogger implements LDLogger {
  private _logLevel: number;

  private _name: string;

  private _destinations?: Record<number, (line: string) => void>;

  private _formatter?: (...args: any[]) => string;

  /**
   * This should only be used as a default fallback and not as a convenient
   * solution. In most cases you should construct a new instance with the
   * appropriate options for your specific needs.
   */
  static get() {
    return new BasicLogger({});
  }

  constructor(options: BasicLoggerOptions) {
    this._logLevel = LogPriority[options.level ?? 'info'] ?? LogPriority.info;
    this._name = options.name ?? 'LaunchDarkly';
    this._formatter = options.formatter;
    if (typeof options.destination === 'object') {
      this._destinations = {
        [LogPriority.debug]: options.destination.debug,
        [LogPriority.info]: options.destination.info,
        [LogPriority.warn]: options.destination.warn,
        [LogPriority.error]: options.destination.error,
      };
    } else if (typeof options.destination === 'function') {
      const { destination } = options;
      this._destinations = {
        [LogPriority.debug]: destination,
        [LogPriority.info]: destination,
        [LogPriority.warn]: destination,
        [LogPriority.error]: destination,
      };
    }
  }

  private _tryFormat(...args: any[]): string {
    try {
      if (this._formatter) {
        // In case the provided formatter fails.
        return this._formatter?.(...args);
      }
      return format(...args);
    } catch {
      return format(...args);
    }
  }

  private _tryWrite(destination: (msg: string) => void, msg: string) {
    try {
      destination(msg);
    } catch {
      // eslint-disable-next-line no-console
      console.error(msg);
    }
  }

  private _log(level: number, args: any[]) {
    if (level >= this._logLevel) {
      const prefix = `${LEVEL_NAMES[level]}: [${this._name}]`;
      try {
        const destination = this._destinations?.[level];
        if (destination) {
          this._tryWrite(destination, `${prefix} ${this._tryFormat(...args)}`);
        } else {
          // `console.error` has its own formatter.
          // So we don't need to do anything.
          // eslint-disable-next-line no-console
          console.error(...args);
        }
      } catch {
        // If all else fails do not break.
        // eslint-disable-next-line no-console
        console.error(...args);
      }
    }
  }

  error(...args: any[]): void {
    this._log(LogPriority.error, args);
  }

  warn(...args: any[]): void {
    this._log(LogPriority.warn, args);
  }

  info(...args: any[]): void {
    this._log(LogPriority.info, args);
  }

  debug(...args: any[]): void {
    this._log(LogPriority.debug, args);
  }
}
