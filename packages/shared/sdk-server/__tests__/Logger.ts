import { LDLogger, LDLogLevel } from '@launchdarkly/js-sdk-common';

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

type ExpectedMessage = { level: LogLevel; matches: RegExp };

function replacer(key: string, value: any) {
  if (value instanceof RegExp) {
    return value.toString();
  }

  return value;
}

export default class TestLogger implements LDLogger {
  private readonly _messages: Record<LDLogLevel, string[]> = {
    debug: [],
    info: [],
    warn: [],
    error: [],
    // Should not be used to log.
    none: [],
  };

  private _callCount = 0;

  private _waiters: Array<() => void> = [];

  timeout(timeoutMs: number): Promise<number> {
    return new Promise<number>((resolve) => {
      setTimeout(() => resolve(this._callCount), timeoutMs);
    });
  }

  async waitForMessages(count: number, timeoutMs: number = 1000): Promise<number> {
    return Promise.race([
      new Promise<number>((resolve) => {
        const waiter = () => {
          if (this._callCount >= count) {
            resolve(this._callCount);
          }
        };
        waiter();
        this._waiters.push(waiter);
      }),
      this.timeout(timeoutMs),
    ]);
  }

  /**
   * Check received messages for expected messages.
   *
   * @param expectedMessages List of expected messages. If a message is expected
   * more  than once, then it should be included multiple times.
   * @returns A list of messages that were not received.
   */
  expectMessages(expectedMessages: ExpectedMessage[]): void {
    const matched: Record<LDLogLevel, number[]> = {
      debug: [],
      info: [],
      warn: [],
      error: [],
      none: [],
    };

    expectedMessages.forEach((expectedMessage) => {
      const received = this._messages[expectedMessage.level];
      const index = received.findIndex((receivedMessage) =>
        receivedMessage.match(expectedMessage.matches),
      );
      if (index < 0) {
        throw new Error(
          `Did not find expected message: ${JSON.stringify(
            expectedMessage,
            replacer,
          )} received: ${JSON.stringify(this._messages)}`,
        );
      } else if (matched[expectedMessage.level].indexOf(index) >= 0) {
        throw new Error(
          `Did not find expected message: ${JSON.stringify(
            expectedMessage,
            replacer,
          )} received: ${JSON.stringify(this._messages)}`,
        );
      } else {
        matched[expectedMessage.level].push(index);
      }
    });
  }

  getCount(level?: LogLevel) {
    if (level === undefined) {
      return this._callCount;
    }
    return this._messages[level].length;
  }

  private _checkResolves() {
    this._waiters.forEach((waiter) => waiter());
  }

  private _log(level: LDLogLevel, ...args: any[]) {
    this._messages[level].push(args.join(' '));
    this._callCount += 1;
    this._checkResolves();
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
