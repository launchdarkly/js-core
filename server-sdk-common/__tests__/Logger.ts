import { LDLogger } from '../src';

export default class TestLogger implements LDLogger {
  public readonly errorMessages: string[] = [];

  public readonly warningMessages: string[] = [];

  public readonly infoMessages: string[] = [];

  public readonly debugMessages: string[] = [];

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

  getCount() {
    return this.callCount;
  }

  checkResolves() {
    this.waiters.forEach((waiter) => waiter());
  }

  error(...args: any[]): void {
    this.errorMessages.push(args.join(' '));
    this.callCount += 1;
  }

  warn(...args: any[]): void {
    this.warningMessages.push(args.join(' '));
    this.callCount += 1;
  }

  info(...args: any[]): void {
    this.infoMessages.push(args.join(' '));
    this.callCount += 1;
  }

  debug(...args: any[]): void {
    this.debugMessages.push(args.join(' '));
    this.callCount += 1;
  }
}
