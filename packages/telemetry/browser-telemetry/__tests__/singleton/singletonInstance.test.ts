import { fallbackLogger } from '../../src/logging';
import { getTelemetryInstance, initTelemetry, resetTelemetryInstance } from '../../src/singleton';

beforeEach(() => {
  resetTelemetryInstance();
  jest.resetAllMocks();
});

it('warns and keeps existing instance when initialized multiple times', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  initTelemetry({ logger: mockLogger });
  const instanceA = getTelemetryInstance();
  initTelemetry({ logger: mockLogger });
  const instanceB = getTelemetryInstance();

  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.stringMatching(/Telemetry has already been initialized/),
  );

  expect(instanceA).toBe(instanceB);
});

it('warns when getting telemetry instance before initialization', () => {
  const spy = jest.spyOn(fallbackLogger, 'warn');

  getTelemetryInstance();

  expect(spy).toHaveBeenCalledWith(expect.stringMatching(/Telemetry has not been initialized/));
});
