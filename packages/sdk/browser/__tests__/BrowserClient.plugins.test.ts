import {
  AutoEnvAttributes,
  Hook,
  HookMetadata,
  LDContext,
  LDLogger,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserClient } from '../src/BrowserClient';
import { LDPlugin } from '../src/LDPlugin';
import { makeBasicPlatform } from './BrowserClient.mocks';

// Test for plugin registration
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

  const platform = makeBasicPlatform();

  const client = new BrowserClient(
    'client-side-id',
    AutoEnvAttributes.Disabled,
    {
      streaming: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin],
    },
    platform,
  );

  // Verify the plugin was registered
  expect(mockPlugin.register).toHaveBeenCalled();

  // Now test that hooks work by calling identify and variation
  const context: LDContext = { key: 'user-key', kind: 'user' };
  await client.identify(context);

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

// Test for multiple plugins with hooks
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

  const platform = makeBasicPlatform();

  const client = new BrowserClient(
    'client-side-id',
    AutoEnvAttributes.Disabled,
    {
      streaming: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin1, mockPlugin2],
    },
    platform,
  );

  // Verify plugins were registered
  expect(mockPlugin1.register).toHaveBeenCalled();
  expect(mockPlugin2.register).toHaveBeenCalled();

  // Test that both hooks work
  await client.identify({ key: 'user-key', kind: 'user' });
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

  const options = {
    wrapperName: 'test-wrapper',
    wrapperVersion: '2.0.0',
    application: {
      name: 'test-app',
      version: '3.0.0',
    },
  };

  const platform = makeBasicPlatform();

  const client = new BrowserClient(
    'client-side-id',
    AutoEnvAttributes.Disabled,
    {
      streaming: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin],
      ...options,
    },
    platform,
  );

  const sdkData = platform.info.sdkData();
  expect(sdkData.name).toBeDefined();
  expect(sdkData.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: sdkData.name,
      version: sdkData.version,
      wrapperName: options.wrapperName,
      wrapperVersion: options.wrapperVersion,
    },
    application: {
      name: options.application.name,
      version: options.application.version,
    },
    clientSideId: 'client-side-id',
  });

  // Verify register was called with correct environmentMetadata
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: sdkData.name,
        version: sdkData.version,
        wrapperName: options.wrapperName,
        wrapperVersion: options.wrapperVersion,
      },
      application: {
        name: options.application.name,
        version: options.application.version,
      },
      clientSideId: 'client-side-id',
    }
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

  const platform = makeBasicPlatform();

  const client = new BrowserClient(
    'client-side-id',
    AutoEnvAttributes.Disabled,
    {
      streaming: false,
      logger,
      diagnosticOptOut: true,
      plugins: [mockPlugin],
    },
    platform,
  );

  const sdkData = platform.info.sdkData();
  expect(sdkData.name).toBeDefined();
  expect(sdkData.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: sdkData.name,
      version: sdkData.version,
    },
    clientSideId: 'client-side-id',
  });

  // Verify register was called with correct environmentMetadata
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: sdkData.name,
        version: sdkData.version,
      },
      clientSideId: 'client-side-id',
    }
  );
});
