import { ElectronOptions } from '../src/ElectronOptions';
import validateOptions, { filterToBaseOptions } from '../src/options';
import { createMockLogger } from './testHelpers';

it('logs no warnings when all configuration is valid', () => {
  const logger = createMockLogger();

  validateOptions(
    {
      enableEventCompression: true,
      initialConnectionMode: 'streaming',
      enableIPC: true,
      plugins: [],
      namespace: 'test-ns',
    },
    logger,
  );

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('warns for invalid configuration', () => {
  const logger = createMockLogger();

  validateOptions(
    {
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

  expect(logger.warn).toHaveBeenCalledTimes(4);
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
  const logger = createMockLogger();
  const opts = validateOptions({}, logger);

  expect(opts.enableEventCompression).toBeUndefined();
  expect(opts.initialConnectionMode).toEqual('streaming');
  expect(opts.plugins).toEqual([]);
  expect(opts.enableIPC).toEqual(true);
  expect(opts.useClientSideId).toEqual(false);
  expect(opts.namespace).toBeUndefined();

  expect(logger.debug).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('applies namespace when set', () => {
  const logger = createMockLogger();
  const opts = validateOptions({ namespace: 'my-ns' }, logger);

  expect(opts.namespace).toEqual('my-ns');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('warns for invalid namespace type', () => {
  const logger = createMockLogger();

  validateOptions(
    {
      // @ts-ignore
      namespace: 42,
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "namespace" should be of type string, got number, using default value',
  );
});

it('applies useClientSideId when set to true', () => {
  const logger = createMockLogger();
  const opts = validateOptions({ useClientSideId: true }, logger);

  expect(opts.useClientSideId).toEqual(true);
});

it('warns for invalid useClientSideId type', () => {
  const logger = createMockLogger();

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
  const logger = createMockLogger();

  const opts: ElectronOptions = {
    debug: false,
    enableEventCompression: true,
    initialConnectionMode: 'streaming',
    enableIPC: true,
    plugins: [],
    useClientSideId: true,
    namespace: 'test-ns',
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

it('applies hash when useClientSideId is true', () => {
  const logger = createMockLogger();
  const opts = validateOptions({ useClientSideId: true, hash: 'secure-hash' }, logger);

  expect(opts.hash).toEqual('secure-hash');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('leaves hash undefined by default', () => {
  const logger = createMockLogger();
  const opts = validateOptions({}, logger);

  expect(opts.hash).toBeUndefined();
});

it('warns for invalid hash type', () => {
  const logger = createMockLogger();

  validateOptions(
    {
      useClientSideId: true,
      // @ts-ignore
      hash: 42,
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "hash" should be of type string, got number, using default value',
  );
});

it('throws when hash is set and the client uses a mobile key', () => {
  const logger = createMockLogger();

  expect(() => validateOptions({ hash: 'secure-hash' }, logger)).toThrow(
    'Invalid configuration: secure mode "hash" is not supported when "useClientSideId" is false. Remove "hash" or set "useClientSideId" to true.',
  );
});

it('throws when hash is set and useClientSideId is explicitly false', () => {
  const logger = createMockLogger();

  expect(() => validateOptions({ useClientSideId: false, hash: 'secure-hash' }, logger)).toThrow(
    /secure mode "hash" is not supported/,
  );
});

it('does not throw when hash is invalid and dropped before the credential check', () => {
  const logger = createMockLogger();

  // @ts-ignore
  const opts = validateOptions({ hash: 42 }, logger);

  expect(opts.hash).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "hash" should be of type string, got number, using default value',
  );
});

it('warns when both dataSystem and initialConnectionMode are set', () => {
  const logger = createMockLogger();

  validateOptions({ dataSystem: {}, initialConnectionMode: 'polling' }, logger);

  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialConnectionMode'));
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('dataSystem'));
});

it('does not warn when only dataSystem is set', () => {
  const logger = createMockLogger();

  validateOptions({ dataSystem: {} }, logger);

  expect(logger.warn).not.toHaveBeenCalled();
});

it('applies a custom storage implementation with get, set and clear functions', () => {
  const logger = createMockLogger();
  const storage = { get: jest.fn(), set: jest.fn(), clear: jest.fn() };

  const opts = validateOptions({ storage }, logger);

  expect(opts.storage).toBe(storage);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('leaves storage undefined by default', () => {
  const logger = createMockLogger();
  const opts = validateOptions({}, logger);

  expect(opts.storage).toBeUndefined();
});

it('warns and falls back to the default storage when storage is not an object', () => {
  const logger = createMockLogger();

  // @ts-ignore
  const opts = validateOptions({ storage: 'disk' }, logger);

  expect(opts.storage).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "storage" should be of type LDElectronStorage ({ get, set, clear }), got string, using default value',
  );
});

it('warns and falls back to the default storage when storage lacks the required functions', () => {
  const logger = createMockLogger();

  // @ts-ignore
  const opts = validateOptions({ storage: { get: jest.fn() } }, logger);

  expect(opts.storage).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "storage" should be of type LDElectronStorage ({ get, set, clear }), got object, using default value',
  );
});

it('applies encryptStorage when set', () => {
  const logger = createMockLogger();
  const opts = validateOptions({ encryptStorage: true }, logger);

  expect(opts.encryptStorage).toBe(true);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('defaults encryptStorage to false', () => {
  const logger = createMockLogger();
  const opts = validateOptions({}, logger);

  expect(opts.encryptStorage).toBe(false);
});

it('warns for invalid encryptStorage type', () => {
  const logger = createMockLogger();

  validateOptions(
    {
      // @ts-ignore
      encryptStorage: 'yes',
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "encryptStorage" should be of type boolean, got string, using default value',
  );
});

it('warns that encryptStorage has no effect when a custom storage is provided', () => {
  const logger = createMockLogger();
  const storage = { get: jest.fn(), set: jest.fn(), clear: jest.fn() };

  const opts = validateOptions({ storage, encryptStorage: true }, logger);

  expect(opts.storage).toBe(storage);
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('encryptStorage'));
});
