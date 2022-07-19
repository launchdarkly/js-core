import { LDLogger, LDLogLevel } from '@launchdarkly/js-sdk-common';

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

type ExpectedMessage = { level: LogLevel, matches: RegExp };

function replacer(key: string, value: any) {
  if (value instanceof RegExp) {
    return value.toString();
  }

  return value;
}

export default class TestLogger implements LDLogger {
  private readonly messages: Record<LDLogLevel, string[]> = {
    debug: [],
    info: [],
    warn: [],
    error: [],
    // Should not be used to log.
    none: [],
  };

  private callCount = 0;

  private waiters: Array<() => void> = [];

  timeout(timeoutMs: number): Promise<number> {
    return new Promise<number>((resolve) => {
      setTimeout(() => resolve(this.callCount), timeoutMs);
    });
  }

  async waitForMessages(count: number, timeoutMs: number = 1000): Promise<number> {
    return Promise.race([
      new Promise<number>((resolve) => {
        const waiter = () => {
          if (this.callCount >= count) {
            resolve(this.callCount);
          }
        };
        waiter();
        this.waiters.push(waiter);
      }), this.timeout(timeoutMs)]);
  }

  /**
   * Check received messages for expected messages.
   *
   * @param expectedMessages List of expected messages. If a message is expected
   * more  than once, then it should be included multiple times.
   * @returns A list of messages that were not received.
   */
  expectMessages(
    expectedMessages: ExpectedMessage[],
  ): void {
    const matched: Record<LDLogLevel, number[]> = {
      debug: [],
      info: [],
      warn: [],
      error: [],
      none: [],
    };

    expectedMessages.forEach((expectedMessage) => {
      const received = this.messages[expectedMessage.level];
      const index = received.findIndex(
        (receivedMessage) => receivedMessage.match(expectedMessage.matches),
      );
      if (index < 0) {
        throw new Error(`Did not find expected message: ${JSON.stringify(expectedMessage, replacer)} received: ${JSON.stringify(this.messages)}`);
      } else if (matched[expectedMessage.level].indexOf(index) >= 0) {
        throw new Error(`Did not find expected message: ${JSON.stringify(expectedMessage, replacer)} received: ${JSON.stringify(this.messages)}`);
      } else {
        matched[expectedMessage.level].push(index);
      }
    });
  }

  getCount(level?: LogLevel) {
    if (level === undefined) {
      return this.callCount;
    }
    return this.messages[level].length;
  }

  private checkResolves() {
    this.waiters.forEach((waiter) => waiter());
  }

  private log(level: LDLogLevel, ...args: any[]) {
    this.messages[level].push(args.join(' '));
    this.callCount += 1;
    this.checkResolves();
  }

  error(...args: any[]): void {
    this.log('error', args);
  }

  warn(...args: any[]): void {
    this.log('warn', args);
  }

  info(...args: any[]): void {
    this.log('info', args);
  }

  debug(...args: any[]): void {
    this.log('debug', args);
  }
}
