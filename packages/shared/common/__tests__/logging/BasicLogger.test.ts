import { BasicLogger, LDLogLevel } from '../../src';

const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
});

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

  it('logs to the console instead of throwing', () => {
    logger.error('a');
    expect(spy).toHaveBeenCalledWith('error: [LaunchDarkly] a');
  });
});

describe('given a logger with a formatter that throws', () => {
  const strings: string[] = [];

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

it('dispatches logs correctly with multiple destinations', () => {
  const debug = jest.fn();
  const info = jest.fn();
  const warn = jest.fn();
  const error = jest.fn();

  const logger = new BasicLogger({
    destination: {
      debug,
      info,
      warn,
      error,
    },
    level: 'debug',
  });

  logger.debug('toDebug');
  logger.info('toInfo');
  logger.warn('toWarn');
  logger.error('toError');

  expect(debug).toHaveBeenCalledTimes(1);
  expect(debug).toHaveBeenCalledWith('debug: [LaunchDarkly] toDebug');

  expect(info).toHaveBeenCalledTimes(1);
  expect(info).toHaveBeenCalledWith('info: [LaunchDarkly] toInfo');

  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith('warn: [LaunchDarkly] toWarn');

  expect(error).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith('error: [LaunchDarkly] toError');
});

it('handles destinations which throw', () => {
  const debug = jest.fn(() => {
    throw new Error('bad');
  });
  const info = jest.fn(() => {
    throw new Error('bad');
  });
  const warn = jest.fn(() => {
    throw new Error('bad');
  });
  const error = jest.fn(() => {
    throw new Error('bad');
  });

  const logger = new BasicLogger({
    destination: {
      debug,
      info,
      warn,
      error,
    },
    level: 'debug',
  });

  logger.debug('toDebug');
  logger.info('toInfo');
  logger.warn('toWarn');
  logger.error('toError');

  expect(spy).toHaveBeenCalledTimes(4);
  expect(spy).toHaveBeenCalledWith('debug: [LaunchDarkly] toDebug');
  expect(spy).toHaveBeenCalledWith('info: [LaunchDarkly] toInfo');
  expect(spy).toHaveBeenCalledWith('warn: [LaunchDarkly] toWarn');
  expect(spy).toHaveBeenCalledWith('error: [LaunchDarkly] toError');
});

it('handles destinations which are not defined', () => {
  const debug = jest.fn();
  const info = jest.fn();
  const logger = new BasicLogger({
    // @ts-ignore
    destination: {
      debug,
      info,
    },
    level: 'debug',
  });

  logger.debug('toDebug');
  logger.info('toInfo');
  logger.warn('toWarn');
  logger.error('toError');

  expect(debug).toHaveBeenCalledTimes(1);
  expect(debug).toHaveBeenCalledWith('debug: [LaunchDarkly] toDebug');

  expect(info).toHaveBeenCalledTimes(1);
  expect(info).toHaveBeenCalledWith('info: [LaunchDarkly] toInfo');

  expect(spy).toHaveBeenCalledTimes(2);

  expect(spy).toHaveBeenCalledWith('toWarn');
  expect(spy).toHaveBeenCalledWith('toError');
});
