import { BasicLoggerOptions, LDLogger } from '../api';
import format from './format';

const LogPriority = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

const LevelNames = ['debug', 'info', 'warn', 'error', 'none'];

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
  private logLevel: number;

  private name: string;

  private destination?: (line: string) => void;

  private formatter?: (...args: any[]) => string;

  constructor(options: BasicLoggerOptions) {
    this.logLevel = LogPriority[options.level ?? 'info'] ?? LogPriority.info;
    this.name = options.name ?? 'LaunchDarkly';
    // eslint-disable-next-line no-console
    this.destination = options.destination;
    this.formatter = options.formatter;
  }

  private tryFormat(...args: any[]): string {
    try {
      if (this.formatter) {
        // In case the provided formatter fails.
        return this.formatter?.(...args);
      }
      return format(...args);
    } catch {
      return format(...args);
    }
  }

  private tryWrite(msg: string) {
    try {
      this.destination!(msg);
    } catch {
      // eslint-disable-next-line no-console
      console.error(msg);
    }
  }

  private log(level: number, args: any[]) {
    if (level >= this.logLevel) {
      const prefix = `${LevelNames[level]}: [${this.name}]`;
      try {
        if (this.destination) {
          this.tryWrite(this.tryFormat(prefix, ...args));
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
    this.log(LogPriority.error, args);
  }

  warn(...args: any[]): void {
    this.log(LogPriority.warn, args);
  }

  info(...args: any[]): void {
    this.log(LogPriority.info, args);
  }

  debug(...args: any[]): void {
    this.log(LogPriority.debug, args);
  }
}
