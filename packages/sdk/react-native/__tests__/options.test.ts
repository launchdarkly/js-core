import { LDLogger } from '@launchdarkly/js-client-sdk-common';

import validateOptions, { filterToBaseOptions } from '../src/options';
import { RNStorage } from '../src/RNOptions';

it('logs no warnings when all configuration is valid', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const storage: RNStorage = {
    get(_key: string): Promise<string | null> {
      throw new Error('Function not implemented.');
    },
    set(_key: string, _value: string): Promise<void> {
      throw new Error('Function not implemented.');
    },
    clear(_key: string): Promise<void> {
      throw new Error('Function not implemented.');
    },
  };

  validateOptions(
    {
      runInBackground: true,
      automaticBackgroundHandling: true,
      automaticNetworkHandling: true,
      storage,
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
      // @ts-ignore
      storage: 'potato',
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledTimes(4);
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "runInBackground" should be of type boolean, got string, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "automaticBackgroundHandling" should be of type boolean, got number, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "automaticNetworkHandling" should be of type boolean, got object, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "storage" should be of type object, got string, using default value',
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
  expect(opts.storage).toBeUndefined();

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
  const storage: RNStorage = {
    get(_key: string): Promise<string | null> {
      throw new Error('Function not implemented.');
    },
    set(_key: string, _value: string): Promise<void> {
      throw new Error('Function not implemented.');
    },
    clear(_key: string): Promise<void> {
      throw new Error('Function not implemented.');
    },
  };

  const opts = {
    debug: false,
    runInBackground: true,
    automaticBackgroundHandling: true,
    automaticNetworkHandling: true,
    storage,
  };

  const baseOpts = filterToBaseOptions(opts);
  expect(baseOpts.debug).toBe(false);
  expect(Object.keys(baseOpts).length).toEqual(1);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});
