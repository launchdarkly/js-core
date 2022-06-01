import { BasicLogger, LDLogLevel } from '../../src';

const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe.each<[LDLogLevel, string[]]>([
  ['debug', ['a', 'b', 'c', 'd']],
  ['info', ['b', 'c', 'd']],
  ['warn', ['c', 'd']],
  ['error', ['d']],
  ['none', []],
])('given a logger with a log level', (level: LDLogLevel, expected: string[]) => {
  const strings: string[] = [];
  const logger = new BasicLogger({
    level,
    destination: (...args: any) => {
      strings.push(args.join(' '));
    },
  });
  it('it only logs messages of that level', () => {
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(strings).toEqual(expected);
  });
});

describe('given a default logger', () => {
  const logger = new BasicLogger({});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs to the console', () => {
    logger.warn('potato', 'bacon');
    expect(spy).toHaveBeenCalledWith('potato', 'bacon');
  });
});

describe('given a logger with a destination that throws', () => {
  const logger = new BasicLogger({
    destination: () => {
      throw new Error('BAD LOGGER');
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs to the console instead of throwing', () => {
    logger.error('a');
    expect(spy).toHaveBeenCalledWith('a');
  });
});

describe('given a logger with a formatter that throws', () => {
  const strings: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const logger = new BasicLogger({
    destination: (...args: any) => {
      strings.push(args.join(' '));
    },
    formatter: () => {
      throw new Error('BAD LOGGER');
    },
  });

  it('logs with default formatting instead of throwing', () => {
    logger.error('a');
    expect(spy).toHaveBeenCalledTimes(0);
  });
});
