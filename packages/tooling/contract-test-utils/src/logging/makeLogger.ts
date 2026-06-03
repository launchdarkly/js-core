import { LDLogger } from '../types/compat.js';

export function makeLogger(tag: string): LDLogger {
  return {
    debug(message: any, ...args: any[]) {
      console.debug(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
    info(message: any, ...args: any[]) {
      console.info(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
    warn(message: any, ...args: any[]) {
      console.warn(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
    error(message: any, ...args: any[]) {
      console.error(`${new Date().toISOString()} [${tag}]: ${message}`, ...args);
    },
  };
}
