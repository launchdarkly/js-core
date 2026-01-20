import { LDLogger } from '@launchdarkly/js-client-sdk-common';

import { ElectronOptions } from '../src/ElectronOptions';
import validateOptions, { filterToBaseOptions } from '../src/options';

it('logs no warnings when all configuration is valid', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  validateOptions(
    {
      proxyOptions: {},
      tlsParams: {},
      enableEventCompression: true,
      initialConnectionMode: 'streaming',
      registerInMain: true,
      plugins: [],
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
      proxyOptions: false,
      // @ts-ignore
      tlsParams: true,
      // @ts-ignore
      enableEventCompression: 'toast',
      // @ts-ignore
      initialConnectionMode: 42,
      // @ts-ignore
      plugins: 'potato',
      // @ts-ignore
      registerInMain: {},
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledTimes(6);
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "proxyOptions" should be of type object, got boolean, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "tlsParams" should be of type object, got boolean, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "enableEventCompression" should be of type boolean, got string, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "initialConnectionMode" should be of type ConnectionMode (offline | streaming | polling), got number, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "plugins" should be of type LDPlugin[], got string, using default value',
  );
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "registerInMain" should be of type boolean, got object, using default value',
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

  expect(opts.proxyOptions).toBeUndefined();
  expect(opts.tlsParams).toBeUndefined();
  expect(opts.enableEventCompression).toBeUndefined();
  expect(opts.initialConnectionMode).toEqual('streaming');
  expect(opts.plugins).toEqual([]);
  expect(opts.registerInMain).toEqual(true);

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

  const opts: ElectronOptions = {
    debug: false,
    proxyOptions: {},
    tlsParams: {},
    enableEventCompression: true,
    initialConnectionMode: 'streaming',
    registerInMain: true,
    plugins: [],
  };

  const baseOpts = filterToBaseOptions(opts);
  expect(baseOpts.debug).toBe(false);
  expect(Object.keys(baseOpts).length).toEqual(1);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});
