import { LDLogger } from '../src';

// TODO: Move this to sdk-common when implementing logging.
export enum LogLevel {
  Debug,
  Info,
  Warn,
  Error,
}

type ExpectedMessage = { level: LogLevel, matches: RegExp };

export default class TestLogger implements LDLogger {
  private readonly messages: Record<LogLevel, string[]> = {
    [LogLevel.Debug]: [],
    [LogLevel.Info]: [],
    [LogLevel.Warn]: [],
    [LogLevel.Error]: [],
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
    const matched: Record<LogLevel, number[]> = {
      [LogLevel.Debug]: [],
      [LogLevel.Info]: [],
      [LogLevel.Warn]: [],
      [LogLevel.Error]: [],
    };

    expectedMessages.forEach((expectedMessage) => {
      const received = this.messages[expectedMessage.level];
      const index = received.findIndex(
        (receivedMessage) => receivedMessage.match(expectedMessage.matches),
      );
      if (index < 0) {
        throw new Error(`Did not find expected message: ${expectedMessage} received: ${this.messages}`);
      } else if (matched[expectedMessage.level].indexOf(index) >= 0) {
        throw new Error(`Did not find expected message: ${expectedMessage} received: ${this.messages}`);
      } else {
        matched[expectedMessage.level].push(index);
      }
    });
  }

  getCount() {
    return this.callCount;
  }

  private checkResolves() {
    this.waiters.forEach((waiter) => waiter());
  }

  private log(level: LogLevel, ...args: any[]) {
    this.messages[level].push(args.join(' '));
    this.callCount += 1;
    this.checkResolves();
  }

  error(...args: any[]): void {
    this.log(LogLevel.Error, args);
  }

  warn(...args: any[]): void {
    this.log(LogLevel.Warn, args);
  }

  info(...args: any[]): void {
    this.log(LogLevel.Info, args);
  }

  debug(...args: any[]): void {
    this.log(LogLevel.Debug, args);
  }
}
