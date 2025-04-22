import { MinLogger } from '../src/api';
import { fallbackLogger, prefixLog, safeMinLogger } from '../src/logging';

afterEach(() => {
  jest.resetAllMocks();
});

it('prefixes the message with the telemetry prefix', () => {
  const message = 'test message';
  const prefixed = prefixLog(message);
  expect(prefixed).toBe('LaunchDarkly - Browser Telemetry: test message');
});

it('uses fallback logger when no logger provided', () => {
  const spy = jest.spyOn(fallbackLogger, 'warn');
  const logger = safeMinLogger(undefined);

  logger.warn('test message');

  expect(spy).toHaveBeenCalledWith('test message');
  spy.mockRestore();
});

it('uses provided logger when it works correctly', () => {
  const mockWarn = jest.fn();
  const testLogger: MinLogger = {
    warn: mockWarn,
  };

  const logger = safeMinLogger(testLogger);
  logger.warn('test message');

  expect(mockWarn).toHaveBeenCalledWith('test message');
});

it('falls back to fallback logger when provided logger throws', () => {
  const spy = jest.spyOn(fallbackLogger, 'warn');
  const testLogger: MinLogger = {
    warn: () => {
      throw new Error('logger error');
    },
  };

  const logger = safeMinLogger(testLogger);
  logger.warn('test message');

  expect(spy).toHaveBeenCalledWith('test message');
  expect(spy).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: The provided logger threw an exception, using fallback logger.',
  );
  spy.mockRestore();
});
