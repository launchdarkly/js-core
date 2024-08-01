import { LDLogger } from '@launchdarkly/js-client-sdk-common';

import validateOptions, { filterToBaseOptions } from './options';

it('logs no warnings when all configuration is valid', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  validateOptions(
    {
      runInBackground: true,
      automaticBackgroundHandling: true,
      automaticNetworkHandling: true,
    },
    logger,
  );

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('warns for invalid configuration', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  validateOptions(
    {
      // @ts-ignore
      runInBackground: 'toast',
      // @ts-ignore
      automaticBackgroundHandling: 42,
      // @ts-ignore
      automaticNetworkHandling: {},
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledTimes(3);
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "runInBackground" should be of type boolean, got string, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "automaticBackgroundHandling" should be of type boolean, got number, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "automaticNetworkHandling" should be of type boolean, got object, using default value',
  );
});

it('applies default options', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const opts = validateOptions({}, logger);

  expect(opts.runInBackground).toBe(false);
  expect(opts.automaticBackgroundHandling).toBe(true);
  expect(opts.automaticNetworkHandling).toBe(true);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('filters to base options', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const opts = {
    debug: false,
    runInBackground: true,
    automaticBackgroundHandling: true,
    automaticNetworkHandling: true,
  };

  const baseOpts = filterToBaseOptions(opts);
  expect(baseOpts.debug).toBe(false);
  expect(Object.keys(baseOpts).length).toEqual(1);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});
