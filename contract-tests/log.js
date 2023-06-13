import ld from 'node-server-sdk';

export function Log(tag) {
  function doLog(level, message) {
    console.log(new Date().toISOString() + ` [${tag}] ${level}: ${message}`);
  }
  return {
    info: (message) => doLog('info', message),
    error: (message) => doLog('error', message),
  };
}

export function sdkLogger(tag) {
  return ld.basicLogger({
    level: 'debug',
    destination: (line) => {
      console.log(new Date().toISOString() + ` [${tag}.sdk] ${line}`);
    },
  });
}
