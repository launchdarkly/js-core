import ld from '@launchdarkly/node-server-sdk';

export interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
}

export function Log(tag: string): Logger {
  function doLog(level: string, message: string): void {
    console.log(`${new Date().toISOString()} [${tag}] ${level}: ${message}`);
  }
  return {
    info: (message: string) => doLog('info', message),
    error: (message: string) => doLog('error', message),
  };
}

export function sdkLogger(tag: string): ld.LDLogger {
  return ld.basicLogger({
    level: 'debug',
    destination: (line: string) => {
      console.log(`${new Date().toISOString()} [${tag}.sdk] ${line}`);
    },
  });
}
