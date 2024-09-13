import { LDLogger } from '@launchdarkly/js-client-sdk';

export function makeLogger(tag: string): LDLogger {
  return {
    debug(...args: any[]) {
      // eslint-disable-next-line no-console
      console.debug(`${new Date().toISOString()} [${tag}]:`, ...args);
    },
    info(...args: any[]) {
      // eslint-disable-next-line no-console
      console.info(`${new Date().toISOString()} [${tag}]:`, ...args);
    },
    warn(...args: any[]) {
      // eslint-disable-next-line no-console
      console.warn(`${new Date().toISOString()} [${tag}]:`, ...args);
    },
    error(...args: any[]) {
      // eslint-disable-next-line no-console
      console.error(`${new Date().toISOString()} [${tag}]:`, ...args);
    },
  };
}
