import j from './getJest';

const logger = {
  error: j.fn(),
  warn: j.fn(),
  info: j.fn(),
  debug: j.fn(),
};

export default logger;
