import type { LDLogger } from '@launchdarkly/electron-client-sdk';

export function makeLogger(tag: string): LDLogger {
  return {
    debug(message: any, ...args: any[]) {
      // eslint-disable-next-line no-console
      console.debug(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
    info(message: any, ...args: any[]) {
      // eslint-disable-next-line no-console
      console.info(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
    warn(message: any, ...args: any[]) {
      // eslint-disable-next-line no-console
      console.warn(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
    error(message: any, ...args: any[]) {
      // eslint-disable-next-line no-console
      console.error(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
  };
}
