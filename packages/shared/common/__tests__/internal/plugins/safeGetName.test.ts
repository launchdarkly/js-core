import { LDPluginBase } from '../../../src/api/integrations/plugins';
import { LDLogger } from '../../../src/api/logging/LDLogger';
import { safeGetName } from '../../../src/internal/plugins/safeGetName';

it('returns plugin the name when metadata is available', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockPlugin: LDPluginBase<unknown, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: 'test-plugin' }),
    register: jest.fn(),
  };

  const result = safeGetName(mockLogger, mockPlugin);

  expect(result).toBe('test-plugin');
  expect(mockLogger.error).not.toHaveBeenCalled();
});

it('returns "unknown plugin" when the metadata name is undefined', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockPlugin: LDPluginBase<unknown, unknown> = {
    getMetadata: jest.fn().mockReturnValue({ name: undefined }),
    register: jest.fn(),
  };

  const result = safeGetName(mockLogger, mockPlugin);

  expect(result).toBe('unknown plugin');
  expect(mockLogger.error).not.toHaveBeenCalled();
});

it('returns "unknown plugin" and logs an error when getMetadata throws', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockPlugin: LDPluginBase<unknown, unknown> = {
    getMetadata: jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    }),
    register: jest.fn(),
  };

  const result = safeGetName(mockLogger, mockPlugin);

  expect(result).toBe('unknown plugin');
  expect(mockLogger.error).toHaveBeenCalledWith(
    'Exception thrown getting metadata for plugin. Unable to get plugin name.',
  );
});
