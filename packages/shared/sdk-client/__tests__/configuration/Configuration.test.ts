/* eslint-disable no-console */
import { createSafeLogger } from '@launchdarkly/js-sdk-common';

import ConfigurationImpl from '../../src/configuration/Configuration';

describe('Configuration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    console.error = jest.fn();
  });

  it('has valid default values', () => {
    const config = new ConfigurationImpl();

    expect(config).toMatchObject({
      allAttributesPrivate: false,
      baseUri: 'https://clientsdk.launchdarkly.com',
      capacity: 100,
      debug: false,
      diagnosticOptOut: false,
      diagnosticRecordingInterval: 900,
      withReasons: false,
      eventsUri: 'https://events.launchdarkly.com',
      flushInterval: 30,
      logger: {
        _destination: console.error,
        _logLevel: 1,
        _name: 'LaunchDarkly',
      },
      maxCachedContexts: 5,
      privateAttributes: [],
      sendEvents: true,
      sendLDHeaders: true,
      streamInitialReconnectDelay: 1,
      streamUri: 'https://clientstream.launchdarkly.com',
      useReport: false,
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('allows specifying valid wrapperName', () => {
    const config = new ConfigurationImpl({ wrapperName: 'test' });
    expect(config).toMatchObject({ wrapperName: 'test' });
  });

  it('warns and ignored invalid keys', () => {
    // @ts-ignore
    const config = new ConfigurationImpl({ baseballUri: 1 });

    expect(config.baseballUri).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unknown config option'));
  });

  it('converts boolean types', () => {
    // @ts-ignore
    const config = new ConfigurationImpl({ sendEvents: 0 });

    expect(config.sendEvents).toBeFalsy();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('should be a boolean, got number, converting'),
    );
  });

  it('ignores wrong type for number and logs appropriately', () => {
    // @ts-ignore
    const config = new ConfigurationImpl({ capacity: true });

    expect(config.capacity).toEqual(100);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('should be of type number with minimum value of 1, got boolean'),
    );
  });

  it('enforces minimum flushInterval', () => {
    const config = new ConfigurationImpl({ flushInterval: 1 });

    expect(config.flushInterval).toEqual(2);
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"flushInterval" had invalid value of 1, using minimum of 2 instead'),
    );
  });

  it('allows setting a valid maxCachedContexts', () => {
    const config = new ConfigurationImpl({ maxCachedContexts: 3 });

    expect(config.maxCachedContexts).toBeDefined();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('enforces minimum maxCachedContext', () => {
    const config = new ConfigurationImpl({ maxCachedContexts: -1 });

    expect(config.maxCachedContexts).toBeDefined();
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('had invalid value of -1'),
    );
  });

  it.each([
    ['1'],
    ['camelCaseWorks'],
    ['PascalCaseWorks'],
    ['kebab-case-works'],
    ['snake_case_works'],
  ])('allow setting valid payload filter keys', (filter) => {
    const config = new ConfigurationImpl({ payloadFilterKey: filter });
    expect(config.payloadFilterKey).toEqual(filter);
    expect(console.error).toHaveBeenCalledTimes(0);
  });

  it.each([['invalid-@-filter'], ['_invalid-filter'], ['-invalid-filter']])(
    'ignores invalid filters and logs a warning',
    (filter) => {
      const config = new ConfigurationImpl({ payloadFilterKey: filter });
      expect(config.payloadFilterKey).toBeUndefined();
      expect(console.error).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/should be of type string matching/i),
      );
    },
  );
});

it('makes a safe logger', () => {
  const badLogger = {
    debug: () => {
      throw new Error('bad');
    },
    info: () => {
      throw new Error('bad');
    },
    warn: () => {
      throw new Error('bad');
    },
    error: () => {
      throw new Error('bad');
    },
  };
  const config = new ConfigurationImpl({
    logger: badLogger,
  });

  expect(() => config.logger.debug('debug')).not.toThrow();
  expect(() => config.logger.info('info')).not.toThrow();
  expect(() => config.logger.warn('warn')).not.toThrow();
  expect(() => config.logger.error('error')).not.toThrow();
  expect(config.logger).not.toBe(badLogger);
});

it('does not wrap already safe loggers', () => {
  const logger = createSafeLogger({
    debug: () => {
      throw new Error('bad');
    },
    info: () => {
      throw new Error('bad');
    },
    warn: () => {
      throw new Error('bad');
    },
    error: () => {
      throw new Error('bad');
    },
  });
  const config = new ConfigurationImpl({ logger });
  expect(config.logger).toBe(logger);
});
