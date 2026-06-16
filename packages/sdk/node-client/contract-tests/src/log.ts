import { basicLogger, LDLogger } from '@launchdarkly/node-client-sdk';

export interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
}

export function Log(tag: string): Logger {
  function doLog(level: string, message: string): void {
    // eslint-disable-next-line no-console
    console.log(`${new Date().toISOString()} [${tag}] ${level}: ${message}`);
  }
  return {
    info: (message: string) => doLog('info', message),
    error: (message: string) => doLog('error', message),
  };
}

export function sdkLogger(tag: string): LDLogger {
  return basicLogger({
    level: 'debug',
    destination: (line: string) => {
      // eslint-disable-next-line no-console
      console.log(`${new Date().toISOString()} [${tag}.sdk] ${line}`);
    },
  });
}
