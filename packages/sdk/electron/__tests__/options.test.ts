import { validateAndMapOptions } from '../src/options';
import { createMockLogger } from './testHelpers';

it('logs no warnings when all electron-only configuration is valid', () => {
  const logger = createMockLogger();

  validateAndMapOptions(
    {
      tlsParams: {},
      enableEventCompression: true,
      initialConnectionMode: 'streaming',
      enableIPC: true,
      plugins: [],
      namespace: 'test-ns',
      useClientSideId: true,
    },
    logger,
  );

  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('applies electron defaults and maps to mobile key by default', () => {
  const logger = createMockLogger();
  const { nodeOptions, electron } = validateAndMapOptions({}, logger);

  expect(electron.enableIPC).toBe(true);
  expect(electron.namespace).toBeUndefined();
  // Default useClientSideId is false -> useMobileKey true.
  expect(nodeOptions.useMobileKey).toBe(true);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('maps useClientSideId=true to useMobileKey=false', () => {
  const logger = createMockLogger();
  const { nodeOptions } = validateAndMapOptions({ useClientSideId: true }, logger);
  expect(nodeOptions.useMobileKey).toBe(false);
});

it('strips electron-only keys from the node options it produces', () => {
  const logger = createMockLogger();
  const { nodeOptions } = validateAndMapOptions(
    { enableIPC: false, useClientSideId: true, namespace: 'ns' },
    logger,
  );
  expect((nodeOptions as any).enableIPC).toBeUndefined();
  expect((nodeOptions as any).useClientSideId).toBeUndefined();
  expect((nodeOptions as any).namespace).toBeUndefined();
});

it('passes through node-facing options unchanged', () => {
  const logger = createMockLogger();
  const { nodeOptions } = validateAndMapOptions(
    { tlsParams: { rejectUnauthorized: true }, initialConnectionMode: 'polling', debug: true },
    logger,
  );
  expect(nodeOptions.tlsParams).toEqual({ rejectUnauthorized: true });
  expect(nodeOptions.initialConnectionMode).toBe('polling');
  expect((nodeOptions as any).debug).toBe(true);
});

it('applies namespace when set', () => {
  const logger = createMockLogger();
  const { electron } = validateAndMapOptions({ namespace: 'my-ns' }, logger);
  expect(electron.namespace).toBe('my-ns');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('warns and falls back for invalid enableIPC type', () => {
  const logger = createMockLogger();
  // @ts-ignore intentionally invalid
  const { electron } = validateAndMapOptions({ enableIPC: {} }, logger);
  expect(electron.enableIPC).toBe(true);
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "enableIPC" should be of type boolean, got object, using default value',
  );
});

it('warns and falls back for invalid useClientSideId type', () => {
  const logger = createMockLogger();
  // @ts-ignore intentionally invalid
  const { nodeOptions } = validateAndMapOptions({ useClientSideId: 'true' }, logger);
  // Falls back to default false -> useMobileKey true.
  expect(nodeOptions.useMobileKey).toBe(true);
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "useClientSideId" should be of type boolean, got string, using default value',
  );
});

it('warns and falls back for invalid namespace type', () => {
  const logger = createMockLogger();
  // @ts-ignore intentionally invalid
  const { electron } = validateAndMapOptions({ namespace: 42 }, logger);
  expect(electron.namespace).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "namespace" should be of type string, got number, using default value',
  );
});

it('defaults wrapperName and wrapperVersion when not provided', () => {
  const logger = createMockLogger();
  const { nodeOptions } = validateAndMapOptions({}, logger);
  expect(nodeOptions.wrapperName).toBe('@launchdarkly/electron-client-sdk');
  expect(nodeOptions.wrapperVersion).toBe('0.0.1');
});

it('does not override an explicitly provided wrapperName/wrapperVersion', () => {
  const logger = createMockLogger();
  const { nodeOptions } = validateAndMapOptions(
    { wrapperName: 'my-wrapper', wrapperVersion: '9.9.9' },
    logger,
  );
  expect(nodeOptions.wrapperName).toBe('my-wrapper');
  expect(nodeOptions.wrapperVersion).toBe('9.9.9');
});
