import { Breadcrumb, LDClientTracking } from '../../src/api';
import { BrowserTelemetry } from '../../src/api/BrowserTelemetry';
import { BrowserTelemetryInspector } from '../../src/api/client/BrowserTelemetryInspector';
import { getTelemetryInstance } from '../../src/singleton/singletonInstance';
import {
  addBreadcrumb,
  captureError,
  captureErrorEvent,
  close,
  inspectors,
  register,
} from '../../src/singleton/singletonMethods';

jest.mock('../../src/singleton/singletonInstance');

const mockTelemetry: jest.Mocked<BrowserTelemetry> = {
  inspectors: jest.fn(),
  captureError: jest.fn(),
  captureErrorEvent: jest.fn(),
  addBreadcrumb: jest.fn(),
  register: jest.fn(),
  close: jest.fn(),
};

const mockGetTelemetryInstance = getTelemetryInstance as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
});

it('returns empty array when telemetry is not initialized for inspectors', () => {
  mockGetTelemetryInstance.mockReturnValue(undefined);
  expect(() => inspectors()).not.toThrow();
  expect(inspectors()).toEqual([]);
});

it('returns inspectors when telemetry is initialized', () => {
  const mockInspectors: BrowserTelemetryInspector[] = [
    { name: 'test-inspector', type: 'flag-used', synchronous: true, method: () => {} },
  ];
  mockGetTelemetryInstance.mockReturnValue(mockTelemetry);
  mockTelemetry.inspectors.mockReturnValue(mockInspectors);

  expect(inspectors()).toBe(mockInspectors);
});

it('does not crash when calling captureError with no telemetry instance', () => {
  mockGetTelemetryInstance.mockReturnValue(undefined);
  const error = new Error('test error');

  expect(() => captureError(error)).not.toThrow();

  expect(mockTelemetry.captureError).not.toHaveBeenCalled();
});

it('captures errors when telemetry is initialized', () => {
  mockGetTelemetryInstance.mockReturnValue(mockTelemetry);
  const error = new Error('test error');

  captureError(error);

  expect(mockTelemetry.captureError).toHaveBeenCalledWith(error);
});

it('it does not crash when calling captureErrorEvent with no telemetry instance', () => {
  mockGetTelemetryInstance.mockReturnValue(undefined);
  const errorEvent = new ErrorEvent('error', { error: new Error('test error') });

  expect(() => captureErrorEvent(errorEvent)).not.toThrow();

  expect(mockTelemetry.captureErrorEvent).not.toHaveBeenCalled();
});

it('captures error event when telemetry is initialized', () => {
  mockGetTelemetryInstance.mockReturnValue(mockTelemetry);
  const errorEvent = new ErrorEvent('error', { error: new Error('test error') });

  captureErrorEvent(errorEvent);

  expect(mockTelemetry.captureErrorEvent).toHaveBeenCalledWith(errorEvent);
});

it('does not crash when calling addBreadcrumb with no telemetry instance', () => {
  mockGetTelemetryInstance.mockReturnValue(undefined);
  const breadcrumb: Breadcrumb = {
    type: 'custom',
    data: { test: 'data' },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  };

  expect(() => addBreadcrumb(breadcrumb)).not.toThrow();

  expect(mockTelemetry.addBreadcrumb).not.toHaveBeenCalled();
});

it('adds breadcrumb when telemetry is initialized', () => {
  mockGetTelemetryInstance.mockReturnValue(mockTelemetry);
  const breadcrumb: Breadcrumb = {
    type: 'custom',
    data: { test: 'data' },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  };

  addBreadcrumb(breadcrumb);

  expect(mockTelemetry.addBreadcrumb).toHaveBeenCalledWith(breadcrumb);
});

it('does not crash when calling register with no telemetry instance', () => {
  mockGetTelemetryInstance.mockReturnValue(undefined);
  const mockClient: jest.Mocked<LDClientTracking> = {
    track: jest.fn(),
  };

  expect(() => register(mockClient)).not.toThrow();

  expect(mockTelemetry.register).not.toHaveBeenCalled();
});

it('registers client when telemetry is initialized', () => {
  mockGetTelemetryInstance.mockReturnValue(mockTelemetry);
  const mockClient: jest.Mocked<LDClientTracking> = {
    track: jest.fn(),
  };

  register(mockClient);

  expect(mockTelemetry.register).toHaveBeenCalledWith(mockClient);
});

it('does not crash when calling close with no telemetry instance', () => {
  mockGetTelemetryInstance.mockReturnValue(undefined);

  expect(() => close()).not.toThrow();

  expect(mockTelemetry.close).not.toHaveBeenCalled();
});

it('closes when telemetry is initialized', () => {
  mockGetTelemetryInstance.mockReturnValue(mockTelemetry);

  close();

  expect(mockTelemetry.close).toHaveBeenCalled();
});
