import { integrations, LDContext, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDOptions } from '../src/api/LDOptions';
import { LDPlugin } from '../src/api/LDPlugin';
import LDClientNode from '../src/LDClientNode';
import NodeInfo from '../src/platform/NodeInfo';

// Test for plugin registration
it('registers plugins and executes hooks during initialization', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: integrations.Hook = {
    getMetadata(): integrations.HookMetadata {
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
    getHooks: () => [mockHook],
  };

  const client = new LDClientNode('test', { offline: true, logger, plugins: [mockPlugin] });

  // Verify the plugin was registered
  expect(mockPlugin.register).toHaveBeenCalled();

  // Now test that hooks work by calling identify and variation
  const context: LDContext = { key: 'user-key', kind: 'user' };

  await client.variation('flag-key', context, false);

  expect(mockHook.beforeEvaluation).toHaveBeenCalledWith(
    {
      context,
      defaultValue: false,
      flagKey: 'flag-key',
      method: 'LDClient.variation',
      environmentId: undefined,
    },
    {},
  );

  expect(mockHook.afterEvaluation).toHaveBeenCalled();
});

// Test for multiple plugins with hooks
it('registers multiple plugins and executes all hooks', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook1: integrations.Hook = {
    getMetadata(): integrations.HookMetadata {
      return {
        name: 'test-hook-1',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
  };

  const mockHook2: integrations.Hook = {
    getMetadata(): integrations.HookMetadata {
      return {
        name: 'test-hook-2',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
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

  const client = new LDClientNode('test', {
    offline: true,
    logger,
    plugins: [mockPlugin1, mockPlugin2],
  });

  // Verify plugins were registered
  expect(mockPlugin1.register).toHaveBeenCalled();
  expect(mockPlugin2.register).toHaveBeenCalled();

  // Test that both hooks work
  const context: LDContext = { key: 'user-key', kind: 'user' };
  await client.variation('flag-key', context, false);

  expect(mockHook1.beforeEvaluation).toHaveBeenCalled();
  expect(mockHook1.afterEvaluation).toHaveBeenCalled();
  expect(mockHook2.beforeEvaluation).toHaveBeenCalled();
  expect(mockHook2.afterEvaluation).toHaveBeenCalled();
});

it('passes correct environmentMetadata to plugin getHooks and register functions', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: integrations.Hook = {
    getMetadata(): integrations.HookMetadata {
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
    wrapperName: 'test-wrapper',
    wrapperVersion: '2.0.0',
    application: {
      id: 'test-app',
      name: 'TestApp',
      version: '3.0.0',
      versionName: '3',
    },
    offline: true,
    logger,
    plugins: [mockPlugin],
  };

  // eslint-disable-next-line no-new
  new LDClientNode('test', options);
  const platformInfo = new NodeInfo(options);
  const sdkData = platformInfo.sdkData();
  expect(sdkData.name).toBeDefined();
  expect(sdkData.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: sdkData.userAgentBase,
      version: sdkData.version,
      wrapperName: options.wrapperName,
      wrapperVersion: options.wrapperVersion,
    },
    application: {
      id: options.application?.id,
      name: options.application?.name,
      version: options.application?.version,
      versionName: options.application?.versionName,
    },
    sdkKey: 'test',
  });

  // Verify register was called with correct environmentMetadata
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: sdkData.userAgentBase,
        version: sdkData.version,
        wrapperName: options.wrapperName,
        wrapperVersion: options.wrapperVersion,
      },
      application: {
        id: options.application?.id,
        version: options.application?.version,
        name: options.application?.name,
        versionName: options.application?.versionName,
      },
      sdkKey: 'test',
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

  const mockHook: integrations.Hook = {
    getMetadata(): integrations.HookMetadata {
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
    offline: true,
    logger,
    plugins: [mockPlugin],
  };

  // eslint-disable-next-line no-new
  new LDClientNode('test', options);

  const platformInfo = new NodeInfo(options);
  const sdkData = platformInfo.sdkData();
  expect(sdkData.name).toBeDefined();
  expect(sdkData.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: sdkData.userAgentBase,
      version: sdkData.version,
    },
    sdkKey: 'test',
  });

  // Verify register was called with correct environmentMetadata
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: sdkData.userAgentBase,
        version: sdkData.version,
      },
      sdkKey: 'test',
    },
  );
});
