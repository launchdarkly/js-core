import { BasicLogger, LDLogLevel } from '../../src';

const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe.each<[LDLogLevel, string[]]>([
  [
    'debug',
    [
      'debug: [LaunchDarkly] a',
      'info: [LaunchDarkly] b',
      'warn: [LaunchDarkly] c',
      'error: [LaunchDarkly] d',
    ],
  ],
  ['info', ['info: [LaunchDarkly] b', 'warn: [LaunchDarkly] c', 'error: [LaunchDarkly] d']],
  ['warn', ['warn: [LaunchDarkly] c', 'error: [LaunchDarkly] d']],
  ['error', ['error: [LaunchDarkly] d']],
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

describe('given a logger with a custom name', () => {
  const strings: string[] = [];
  const logger = new BasicLogger({
    level: 'debug',
    name: 'MyLDLogger',
    destination: (...args: any) => {
      strings.push(args.join(' '));
    },
  });

  it('it uses that name in the log', () => {
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    logger.debug('This %s is %s', 'log', 'working');
    logger.debug('This %s is %s', 'log', 'working', 'extra');
    expect(strings).toEqual([
      'debug: [MyLDLogger] a',
      'info: [MyLDLogger] b',
      'warn: [MyLDLogger] c',
      'error: [MyLDLogger] d',
      'debug: [MyLDLogger] This log is working',
      'debug: [MyLDLogger] This log is working extra',
    ]);
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
    expect(spy).toHaveBeenCalledWith('error: [LaunchDarkly] a');
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
