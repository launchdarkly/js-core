import { LDPluginBase, LDPluginEnvironmentMetadata } from '../../../src/api/integrations/plugins';
import { LDLogger } from '../../../src/api/logging/LDLogger';
import { safeRegisterPlugins } from '../../../src/internal/plugins/safeRegisterPlugins';

it('registers plugins successfully', () => {
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

  const mockClient = { id: 'test-client' };

  const plugin1: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'plugin1' }),
    register: jest.fn(),
  };

  const plugin2: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'plugin2' }),
    register: jest.fn(),
  };

  const plugins = [plugin1, plugin2];

  safeRegisterPlugins(mockLogger, mockEnvironmentMetadata, mockClient, plugins);

  expect(plugin1.register).toHaveBeenCalledWith(mockClient, mockEnvironmentMetadata);
  expect(plugin2.register).toHaveBeenCalledWith(mockClient, mockEnvironmentMetadata);
  expect(mockLogger.error).not.toHaveBeenCalled();
});

it('continues processing and logs error when plugin registration throws', () => {
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

  const mockClient = { id: 'test-client' };

  const workingPlugin: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'working-plugin' }),
    register: jest.fn(),
  };

  const throwingPlugin: LDPluginBase<typeof mockClient, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'error-plugin' }),
    register: jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    }),
  };

  const plugins = [throwingPlugin, workingPlugin];

  safeRegisterPlugins(mockLogger, mockEnvironmentMetadata, mockClient, plugins);

  expect(throwingPlugin.register).toHaveBeenCalledWith(mockClient, mockEnvironmentMetadata);
  expect(workingPlugin.register).toHaveBeenCalledWith(mockClient, mockEnvironmentMetadata);
  expect(mockLogger.error).toHaveBeenCalledWith(
    'Exception thrown registering plugin error-plugin.',
  );
});
