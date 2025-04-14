import { jest } from '@jest/globals';

import { LDLogger } from '@launchdarkly/js-client-sdk-common';

import validateBrowserOptions, { filterToBaseOptionsWithDefaults } from '../src/options';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

it('logs no warnings when all configuration is valid', () => {
  validateBrowserOptions(
    {
      fetchGoals: true,
      eventUrlTransformer: (url: string) => url,
    },
    logger,
  );

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('warns for invalid configuration', () => {
  validateBrowserOptions(
    {
      // @ts-ignore
      fetchGoals: 'yes',
      // @ts-ignore
      eventUrlTransformer: 'not a function',
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledTimes(2);
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "fetchGoals" should be of type boolean, got string, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "eventUrlTransformer" should be of type function, got string, using default value',
  );
});

it('applies default browser-specific options', () => {
  const opts = validateBrowserOptions({}, logger);

  expect(opts.fetchGoals).toBe(true);
  expect(opts.eventUrlTransformer).toBeDefined();

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('filters to base options', () => {
  const opts = {
    debug: false,
    fetchGoals: true,
    eventUrlTransformer: (url: string) => url,
  };

  const baseOpts = filterToBaseOptionsWithDefaults(opts);
  expect(baseOpts.debug).toBe(false);
  expect(Object.keys(baseOpts).length).toEqual(2);
  expect(baseOpts).not.toHaveProperty('fetchGoals');
  expect(baseOpts).not.toHaveProperty('eventUrlTransformer');
  expect(baseOpts.flushInterval).toEqual(2);
});

it('applies default overrides to common config flushInterval', () => {
  const opts = {};
  const result = filterToBaseOptionsWithDefaults(opts);
  expect(result.flushInterval).toEqual(2);
});

it('does not override common config flushInterval if it is set', () => {
  const opts = {
    flushInterval: 15,
  };
  const result = filterToBaseOptionsWithDefaults(opts);
  expect(result.flushInterval).toEqual(15);
});
