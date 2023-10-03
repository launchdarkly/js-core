import { LDLogger } from '../api';
import BasicLogger from './BasicLogger';
import format from './format';
import SafeLogger from './SafeLogger';

const createSafeLogger = (logger?: LDLogger) => {
  const basicLogger = new BasicLogger({
    level: 'info',
    // eslint-disable-next-line no-console
    destination: console.error,
    formatter: format,
  });
  return logger ? new SafeLogger(logger, basicLogger) : basicLogger;
};

export default createSafeLogger;
