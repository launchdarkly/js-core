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
      enableIPC: true,
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
      enableIPC: {},
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
    'Config option "enableIPC" should be of type boolean, got object, using default value',
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
  expect(opts.enableIPC).toEqual(true);
  expect(opts.useClientSideId).toEqual(false);

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('applies useClientSideId when set to true', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const opts = validateOptions({ useClientSideId: true }, logger);

  expect(opts.useClientSideId).toEqual(true);
});

it('warns for invalid useClientSideId type', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  validateOptions(
    {
      // @ts-ignore
      useClientSideId: 'true',
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "useClientSideId" should be of type boolean, got string, using default value',
  );
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
    enableIPC: true,
    plugins: [],
    useClientSideId: true,
  };

  const baseOpts = filterToBaseOptions(opts);
  expect(baseOpts.debug).toBe(false);
  expect(Object.keys(baseOpts).length).toEqual(1);
  expect((baseOpts as any).useClientSideId).toBeUndefined();

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});
