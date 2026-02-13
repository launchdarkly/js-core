import {
  Hook,
  HookMetadata,
  LDContext,
  LDLogger,
  LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import { createClient } from '../src/index';
import { LDPlugin } from '../src/LDPlugin';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';

jest.mock('../src/platform/ElectronPlatform', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  })),
}));

beforeAll(() => {
  jest.useFakeTimers();
});

it('registers plugins and executes hooks during initialization', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
    beforeIdentify: jest.fn(() => ({})),
    afterIdentify: jest.fn(() => ({})),
    afterTrack: jest.fn(() => ({})),
  };

  const mockPlugin: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: () => [mockHook],
  };

  const context: LDContext = { key: 'user-key', kind: 'user' };
  const client = createClient('client-side-id', context, {
    initialConnectionMode: 'offline',
    enableIPC: false,
    logger,
    diagnosticOptOut: true,
    plugins: [mockPlugin],
  });

  // Verify the plugin was registered
  expect(mockPlugin.register).toHaveBeenCalled();

  // Now test that hooks work by calling start (which runs identify) and variation
  await client.start();

  expect(mockHook.beforeIdentify).toHaveBeenCalledWith({ context, timeout: undefined }, {});

  expect(mockHook.afterIdentify).toHaveBeenCalledWith(
    { context, timeout: undefined },
    {},
    { status: 'completed' },
  );

  client.variation('flag-key', false);

  expect(mockHook.beforeEvaluation).toHaveBeenCalledWith(
    { context, defaultValue: false, flagKey: 'flag-key' },
    {},
  );

  expect(mockHook.afterEvaluation).toHaveBeenCalled();

  client.track('event-key', { data: true }, 42);

  expect(mockHook.afterTrack).toHaveBeenCalledWith({
    context,
    key: 'event-key',
    data: { data: true },
    metricValue: 42,
  });
});

it('registers multiple plugins and executes all hooks', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook1: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook-1',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
    afterTrack: jest.fn(() => ({})),
  };

  const mockHook2: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook-2',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
    afterTrack: jest.fn(() => ({})),
  };

  const mockPlugin1: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin-1' }),
    register: jest.fn(),
    getHooks: () => [mockHook1],
  };

  const mockPlugin2: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin-2' }),
    register: jest.fn(),
    getHooks: () => [mockHook2],
  };

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'user-key' },
    {
      initialConnectionMode: 'offline',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin1, mockPlugin2],
    },
  );

  // Verify plugins were registered
  expect(mockPlugin1.register).toHaveBeenCalled();
  expect(mockPlugin2.register).toHaveBeenCalled();

  // Test that both hooks work
  await client.start();
  client.variation('flag-key', false);
  client.track('event-key', { data: true }, 42);

  expect(mockHook1.beforeEvaluation).toHaveBeenCalled();
  expect(mockHook1.afterEvaluation).toHaveBeenCalled();
  expect(mockHook2.beforeEvaluation).toHaveBeenCalled();
  expect(mockHook2.afterEvaluation).toHaveBeenCalled();
  expect(mockHook1.afterTrack).toHaveBeenCalled();
  expect(mockHook2.afterTrack).toHaveBeenCalled();
});

it('passes correct environmentMetadata to plugin getHooks and register functions', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
  };

  const mockPlugin: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn(() => [mockHook]),
  };

  const options: LDOptions = {
    applicationInfo: {
      id: 'test-app',
      version: '3.0.0',
      name: 'TestApp',
      versionName: '3',
    },
  };

  createClient(
    'client-side-id',
    { kind: 'user', key: 'user-key' },
    {
      initialConnectionMode: 'offline',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin],
      ...options,
    },
  );

  const envMeta = (mockPlugin.register as jest.Mock).mock.calls[0][1];
  expect(envMeta.sdk.name).toBeDefined();
  expect(envMeta.sdk.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata (mobile key by default)
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: envMeta.sdk.name,
      version: envMeta.sdk.version,
    },
    application: {
      id: options.applicationInfo?.id,
      version: options.applicationInfo?.version,
      name: options.applicationInfo?.name,
      versionName: options.applicationInfo?.versionName,
    },
    mobileKey: 'client-side-id',
  });

  // Verify register was called with correct environmentMetadata (mobile key by default)
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: envMeta.sdk.name,
        version: envMeta.sdk.version,
      },
      application: {
        id: options.applicationInfo?.id,
        version: options.applicationInfo?.version,
        name: options.applicationInfo?.name,
        versionName: options.applicationInfo?.versionName,
      },
      mobileKey: 'client-side-id',
    },
  );
});

it('passes correct environmentMetadata without optional fields', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
  };

  const mockPlugin: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn(() => [mockHook]),
  };

  createClient(
    'client-side-id',
    { kind: 'user', key: 'user-key' },
    {
      initialConnectionMode: 'offline',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin],
    },
  );

  const envMeta = (mockPlugin.register as jest.Mock).mock.calls[0][1];
  expect(envMeta.sdk.name).toBeDefined();
  expect(envMeta.sdk.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata (mobile key by default)
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: envMeta.sdk.name,
      version: envMeta.sdk.version,
    },
    mobileKey: 'client-side-id',
  });

  // Verify register was called with correct environmentMetadata (mobile key by default)
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: envMeta.sdk.name,
        version: envMeta.sdk.version,
      },
      mobileKey: 'client-side-id',
    },
  );
});

it('passes clientSideId in environmentMetadata when useClientSideId is true', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockPlugin: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn(() => []),
  };

  createClient(
    'my-client-side-id',
    { kind: 'user', key: 'user-key' },
    {
      initialConnectionMode: 'offline',
      enableIPC: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin],
      useClientSideId: true,
    },
  );

  const envMeta = (mockPlugin.register as jest.Mock).mock.calls[0][1];

  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: envMeta.sdk.name,
      version: envMeta.sdk.version,
    },
    clientSideId: 'my-client-side-id',
  });

  expect(mockPlugin.register).toHaveBeenCalledWith(expect.any(Object), {
    sdk: {
      name: envMeta.sdk.name,
      version: envMeta.sdk.version,
    },
    clientSideId: 'my-client-side-id',
  });
});
