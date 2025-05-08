import { LDPluginBase, LDPluginEnvironmentMetadata } from '../../../src/api/integrations/plugins';
import { LDLogger } from '../../../src/api/logging/LDLogger';
import { safeGetHooks } from '../../../src/internal/plugins/safeGetHooks';

it('returns hooks from plugins', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockEnvironmentMetadata: LDPluginEnvironmentMetadata = {
    sdk: {
      name: 'test-sdk',
      version: '1.0.0',
    },
  };

  const mockHook1 = {
    getMetadata: () => ({ name: 'hook1' }),
  };

  const mockHook2 = {
    getMetadata: () => ({ name: 'hook2' }),
  };

  const mockHook3 = {
    getMetadata: () => ({ name: 'hook3' }),
  };

  const plugin1: LDPluginBase<unknown, any> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'plugin1' }),
    register: jest.fn(),
    getHooks: jest.fn().mockReturnValue([mockHook1, mockHook2]),
  };

  const plugin2: LDPluginBase<unknown, any> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'plugin2' }),
    register: jest.fn(),
    getHooks: jest.fn().mockReturnValue([mockHook3]),
  };

  const plugins = [plugin1, plugin2];
  const hooks = safeGetHooks(mockLogger, mockEnvironmentMetadata, plugins);

  expect(hooks).toHaveLength(3);
  expect(hooks).toContain(mockHook1);
  expect(hooks).toContain(mockHook2);
  expect(hooks).toContain(mockHook3);
  expect(mockLogger.error).not.toHaveBeenCalled();
});

it('handles plugins without getHooks method', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockEnvironmentMetadata: LDPluginEnvironmentMetadata = {
    sdk: {
      name: 'test-sdk',
      version: '1.0.0',
    },
  };

  const plugin: LDPluginBase<unknown, any> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'test-plugin' }),
    register: jest.fn(),
    // No getHooks method
  };

  const hooks = safeGetHooks(mockLogger, mockEnvironmentMetadata, [plugin]);

  expect(hooks).toHaveLength(0);
  expect(mockLogger.error).toHaveBeenCalledWith(
    'Plugin test-plugin returned undefined from getHooks.',
  );
});

it('handles plugins that return empty hooks array', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockEnvironmentMetadata: LDPluginEnvironmentMetadata = {
    sdk: {
      name: 'test-sdk',
      version: '1.0.0',
    },
  };

  const plugin: LDPluginBase<unknown, any> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn().mockReturnValue([]),
  };

  const hooks = safeGetHooks(mockLogger, mockEnvironmentMetadata, [plugin]);

  expect(hooks).toHaveLength(0);
  expect(mockLogger.error).not.toHaveBeenCalled();
});

it('handles plugins that return undefined from getHooks', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockEnvironmentMetadata: LDPluginEnvironmentMetadata = {
    sdk: {
      name: 'test-sdk',
      version: '1.0.0',
    },
  };

  const plugin: LDPluginBase<unknown, any> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn().mockReturnValue(undefined),
  };

  const hooks = safeGetHooks(mockLogger, mockEnvironmentMetadata, [plugin]);

  expect(hooks).toHaveLength(0);
  expect(mockLogger.error).toHaveBeenCalledWith(
    'Plugin test-plugin returned undefined from getHooks.',
  );
});

it('continues processing and logs error when getHooks throws', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockEnvironmentMetadata: LDPluginEnvironmentMetadata = {
    sdk: {
      name: 'test-sdk',
      version: '1.0.0',
    },
  };

  // Create a valid hook object
  const mockHook = {
    getMetadata: () => ({ name: 'working-hook' }),
    beforeEvaluation: jest.fn(() => ({})),
  };

  const workingPlugin: LDPluginBase<unknown, any> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'working-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn().mockReturnValue([mockHook]),
  };

  const throwingPlugin: LDPluginBase<unknown, any> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'error-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    }),
  };

  const hooks = safeGetHooks(mockLogger, mockEnvironmentMetadata, [throwingPlugin, workingPlugin]);

  expect(hooks).toHaveLength(1);
  expect(hooks).toContain(mockHook);
  expect(mockLogger.error).toHaveBeenCalledWith(
    'Exception thrown getting hooks for plugin error-plugin. Unable to get hooks.',
  );
});
