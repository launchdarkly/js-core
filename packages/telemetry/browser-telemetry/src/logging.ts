import { MinLogger } from './api';

export const fallbackLogger: MinLogger = {
  // Intentionally using console.warn as a fallback logger.
  // eslint-disable-next-line no-console
  warn: console.warn,
};

const loggingPrefix = 'LaunchDarkly - Browser Telemetry:';

export function prefixLog(message: string) {
  return `${loggingPrefix} ${message}`;
}

export function safeMinLogger(logger: MinLogger | undefined): MinLogger {
  return {
    warn: (...args: any[]) => {
      if (!logger) {
        fallbackLogger.warn(...args);
        return;
      }

      try {
        logger.warn(...args);
      } catch {
        fallbackLogger.warn(...args);
        fallbackLogger.warn(
          prefixLog('The provided logger threw an exception, using fallback logger.'),
        );
      }
    },
  };
}
