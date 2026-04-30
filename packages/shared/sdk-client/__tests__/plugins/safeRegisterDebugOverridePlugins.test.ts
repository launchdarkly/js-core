import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDPluginBase } from '../../src/api';
import { LDDebugOverride } from '../../src/api/LDDebugOverride';
import { safeRegisterDebugOverridePlugins } from '../../src/plugins/safeRegisterDebugOverridePlugins';

function createMockLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

function createMockDebugOverride(): LDDebugOverride {
  return {
    setOverride: jest.fn(),
    removeOverride: jest.fn(),
    clearAllOverrides: jest.fn(),
    getAllOverrides: jest.fn().mockReturnValue({}),
  };
}

it('calls registerDebug on every plugin that implements it', () => {
  const logger = createMockLogger();
  const debugOverride = createMockDebugOverride();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockClient = { id: 'test-client' };

  const plugin1: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'plugin1' }),
    register: jest.fn(),
    registerDebug: jest.fn(),
  };

  const plugin2: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'plugin2' }),
    register: jest.fn(),
    registerDebug: jest.fn(),
  };

  safeRegisterDebugOverridePlugins(logger, debugOverride, [plugin1, plugin2]);

  expect(plugin1.registerDebug).toHaveBeenCalledWith(debugOverride);
  expect(plugin2.registerDebug).toHaveBeenCalledWith(debugOverride);
  expect(logger.error).not.toHaveBeenCalled();
});

it('skips plugins that do not implement registerDebug', () => {
  const logger = createMockLogger();
  const debugOverride = createMockDebugOverride();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockClient = { id: 'test-client' };

  const pluginWithDebug: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'with-debug' }),
    register: jest.fn(),
    registerDebug: jest.fn(),
  };

  const pluginWithoutDebug: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'no-debug' }),
    register: jest.fn(),
  };

  safeRegisterDebugOverridePlugins(logger, debugOverride, [
    pluginWithoutDebug,
    pluginWithDebug,
  ]);

  expect(pluginWithDebug.registerDebug).toHaveBeenCalledWith(debugOverride);
  expect(logger.error).not.toHaveBeenCalled();
});

it('continues processing and logs error when registerDebug throws', () => {
  const logger = createMockLogger();
  const debugOverride = createMockDebugOverride();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockClient = { id: 'test-client' };

  const throwingPlugin: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'error-plugin' }),
    register: jest.fn(),
    registerDebug: jest.fn().mockImplementation(() => {
      throw new Error('register-debug failure');
    }),
  };

  const workingPlugin: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'working-plugin' }),
    register: jest.fn(),
    registerDebug: jest.fn(),
  };

  safeRegisterDebugOverridePlugins(logger, debugOverride, [throwingPlugin, workingPlugin]);

  expect(throwingPlugin.registerDebug).toHaveBeenCalledWith(debugOverride);
  expect(workingPlugin.registerDebug).toHaveBeenCalledWith(debugOverride);
  expect(logger.error).toHaveBeenCalledWith(
    'Exception thrown registering plugin error-plugin.',
  );
});

it('handles an empty plugins array without error', () => {
  const logger = createMockLogger();
  const debugOverride = createMockDebugOverride();

  expect(() =>
    safeRegisterDebugOverridePlugins(logger, debugOverride, []),
  ).not.toThrow();

  expect(logger.error).not.toHaveBeenCalled();
});
