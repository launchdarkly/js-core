import { LDClientLogging } from '../src/api';
import { LDClientTracking } from '../src/api/client/LDClientTracking';
import BrowserTelemetryImpl from '../src/BrowserTelemetryImpl';
import { ParsedOptions } from '../src/options';

const mockClient: jest.Mocked<LDClientTracking> = {
  track: jest.fn(),
};

afterEach(() => {
  jest.resetAllMocks();
});

const defaultOptions: ParsedOptions = {
  maxPendingEvents: 100,
  breadcrumbs: {
    maxBreadcrumbs: 50,
    click: true,
    keyboardInput: true,
    http: {
      instrumentFetch: true,
      instrumentXhr: true,
    },
    evaluations: true,
    flagChange: true,
    filters: [],
  },
  stack: {
    source: {
      beforeLines: 5,
      afterLines: 5,
      maxLineLength: 120,
    },
  },
  collectors: [],
  errorFilters: [],
};

it('sends buffered events when client is registered', () => {
  const telemetry = new BrowserTelemetryImpl(defaultOptions);
  const error = new Error('Test error');

  telemetry.captureError(error);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      type: 'Error',
      message: 'Test error',
      stack: { frames: expect.any(Array) },
      breadcrumbs: [],
      sessionId: expect.any(String),
    }),
  );
});

it('limits pending events to maxPendingEvents', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    maxPendingEvents: 2,
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.captureError(new Error('Error 1'));
  telemetry.captureError(new Error('Error 2'));
  telemetry.captureError(new Error('Error 3'));

  telemetry.register(mockClient);

  // Should only see the the session init event and last 2 errors tracked
  expect(mockClient.track).toHaveBeenCalledTimes(3);
  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      message: 'Error 2',
    }),
  );
  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      message: 'Error 3',
    }),
  );
});

it('manages breadcrumbs with size limit', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    breadcrumbs: { ...defaultOptions.breadcrumbs, maxBreadcrumbs: 2 },
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 2 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 3 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  const error = new Error('Test error');
  telemetry.captureError(error);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      breadcrumbs: expect.arrayContaining([
        expect.objectContaining({ data: { id: 2 } }),
        expect.objectContaining({ data: { id: 3 } }),
      ]),
    }),
  );
});

it('handles null/undefined errors gracefully', () => {
  const telemetry = new BrowserTelemetryImpl(defaultOptions);

  // @ts-ignore - Testing runtime behavior with invalid input
  telemetry.captureError(undefined);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      type: 'generic',
      message: 'exception was null or undefined',
      breadcrumbs: [],
    }),
  );
});

it('captures error events', () => {
  const telemetry = new BrowserTelemetryImpl(defaultOptions);
  const error = new Error('Test error');
  const errorEvent = new ErrorEvent('error', { error });

  telemetry.captureErrorEvent(errorEvent);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      type: 'Error',
      message: 'Test error',
      breadcrumbs: [],
    }),
  );
});

it('handles flag evaluation breadcrumbs', () => {
  const telemetry = new BrowserTelemetryImpl(defaultOptions);

  telemetry.handleFlagUsed('test-flag', {
    value: true,
    variationIndex: 1,
    reason: { kind: 'OFF' },
  });

  const error = new Error('Test error');
  telemetry.captureError(error);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      breadcrumbs: expect.arrayContaining([
        expect.objectContaining({
          type: 'flag-evaluated',
          data: {
            key: 'test-flag',
            value: true,
          },
          class: 'feature-management',
        }),
      ]),
    }),
  );
});

it('unregisters collectors on close', () => {
  const mockCollector = {
    register: jest.fn(),
    unregister: jest.fn(),
  };

  const options: ParsedOptions = {
    ...defaultOptions,
    collectors: [mockCollector],
  };

  const telemetry = new BrowserTelemetryImpl(options);
  telemetry.close();

  expect(mockCollector.unregister).toHaveBeenCalled();
});

it('logs event dropped message when maxPendingEvents is reached', () => {
  const mockLogger = {
    warn: jest.fn(),
  };
  const telemetry = new BrowserTelemetryImpl({
    ...defaultOptions,
    maxPendingEvents: 2,
    logger: mockLogger,
  });
  telemetry.captureError(new Error('Test error'));
  expect(mockLogger.warn).not.toHaveBeenCalled();
  telemetry.captureError(new Error('Test error 2'));
  expect(mockLogger.warn).not.toHaveBeenCalled();

  telemetry.captureError(new Error('Test error 3'));
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Maximum pending events reached. Old events will be dropped until the SDK' +
      ' client is registered.',
  );

  telemetry.captureError(new Error('Test error 4'));
  expect(mockLogger.warn).toHaveBeenCalledTimes(1);
});

it('filters breadcrumbs using provided filters', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    breadcrumbs: {
      ...defaultOptions.breadcrumbs,
      click: false,
      evaluations: false,
      flagChange: false,
      http: { instrumentFetch: false, instrumentXhr: false },
      keyboardInput: false,
      filters: [
        // Filter to remove breadcrumbs with id:2
        (breadcrumb) => {
          if (breadcrumb.type === 'custom' && breadcrumb.data?.id === 2) {
            return undefined;
          }
          return breadcrumb;
        },
        // Filter to transform breadcrumbs with id:3
        (breadcrumb) => {
          if (breadcrumb.type === 'custom' && breadcrumb.data?.id === 3) {
            return {
              ...breadcrumb,
              data: { id: 'filtered-3' },
            };
          }
          return breadcrumb;
        },
      ],
    },
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 2 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 3 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  const error = new Error('Test error');
  telemetry.captureError(error);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      breadcrumbs: expect.arrayContaining([
        expect.objectContaining({ data: { id: 1 } }),
        expect.objectContaining({ data: { id: 'filtered-3' } }),
      ]),
    }),
  );

  // Verify breadcrumb with id:2 was filtered out
  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      breadcrumbs: expect.not.arrayContaining([expect.objectContaining({ data: { id: 2 } })]),
    }),
  );
});

it('omits breadcrumb when a filter throws an exception', () => {
  const breadSpy = jest.fn((breadcrumb) => breadcrumb);
  const options: ParsedOptions = {
    ...defaultOptions,
    breadcrumbs: {
      ...defaultOptions.breadcrumbs,
      filters: [
        () => {
          throw new Error('Filter error');
        },
        // This filter should never run
        breadSpy,
      ],
    },
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  const error = new Error('Test error');
  telemetry.captureError(error);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      breadcrumbs: [],
    }),
  );

  expect(breadSpy).not.toHaveBeenCalled();
});

it('omits breadcrumbs when a filter is not a function', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    breadcrumbs: {
      ...defaultOptions.breadcrumbs,
      // @ts-ignore
      filters: ['potato'],
    },
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  const error = new Error('Test error');
  telemetry.captureError(error);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      breadcrumbs: [],
    }),
  );
});

it('warns when a breadcrumb filter is not a function', () => {
  const mockLogger = {
    warn: jest.fn(),
  };
  const options: ParsedOptions = {
    ...defaultOptions,
    // @ts-ignore
    breadcrumbs: { ...defaultOptions.breadcrumbs, filters: ['potato'] },
    logger: mockLogger,
  };

  const telemetry = new BrowserTelemetryImpl(options);
  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Error applying breadcrumb filters: TypeError: filter is not a function',
  );
});

it('warns when a breadcrumb filter throws an exception', () => {
  const mockLogger = {
    warn: jest.fn(),
  };
  const options: ParsedOptions = {
    ...defaultOptions,
    breadcrumbs: {
      ...defaultOptions.breadcrumbs,
      filters: [
        () => {
          throw new Error('Filter error');
        },
      ],
    },
    logger: mockLogger,
  };

  const telemetry = new BrowserTelemetryImpl(options);
  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Error applying breadcrumb filters: Error: Filter error',
  );
});

it('only logs breadcrumb filter error once', () => {
  const mockLogger = {
    warn: jest.fn(),
  };
  const options: ParsedOptions = {
    ...defaultOptions,
    breadcrumbs: {
      ...defaultOptions.breadcrumbs,
      filters: [
        () => {
          throw new Error('Filter error');
        },
      ],
    },
    logger: mockLogger,
  };

  const telemetry = new BrowserTelemetryImpl(options);

  // Add multiple breadcrumbs that will trigger the filter error
  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 2 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  // Verify warning was only logged once
  expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Error applying breadcrumb filters: Error: Filter error',
  );
});

it('uses the client logger when no logger is provided', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    breadcrumbs: {
      ...defaultOptions.breadcrumbs,
      filters: [
        () => {
          throw new Error('Filter error');
        },
      ],
    },
  };

  const telemetry = new BrowserTelemetryImpl(options);

  const mockClientWithLogging: jest.Mocked<LDClientLogging & LDClientTracking> = {
    logger: {
      warn: jest.fn(),
    },
    track: jest.fn(),
  };

  telemetry.register(mockClientWithLogging);

  // Add multiple breadcrumbs that will trigger the filter error
  telemetry.addBreadcrumb({
    type: 'custom',
    data: { id: 1 },
    timestamp: Date.now(),
    class: 'custom',
    level: 'info',
  });

  expect(mockClientWithLogging.logger.warn).toHaveBeenCalledTimes(1);
  expect(mockClientWithLogging.logger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Error applying breadcrumb filters: Error: Filter error',
  );
});

it('sends session init event when client is registered', () => {
  const telemetry = new BrowserTelemetryImpl(defaultOptions);
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:session:init',
    expect.objectContaining({
      sessionId: expect.any(String),
    }),
  );
});

it('applies error filters to captured errors', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    errorFilters: [
      (error) => ({
        ...error,
        message: error.message.replace('secret', 'redacted'),
      }),
    ],
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.captureError(new Error('Error with secret info'));
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      message: 'Error with redacted info',
    }),
  );
});

it('filters out errors when filter returns undefined', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    errorFilters: [() => undefined],
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.captureError(new Error('Test error'));
  telemetry.register(mockClient);

  // Verify only session init event was tracked
  expect(mockClient.track).toHaveBeenCalledTimes(1);
  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:session:init',
    expect.objectContaining({
      sessionId: expect.any(String),
    }),
  );
});

it('applies multiple error filters in sequence', () => {
  const options: ParsedOptions = {
    ...defaultOptions,
    errorFilters: [
      (error) => ({
        ...error,
        message: error.message.replace('secret', 'redacted'),
      }),
      (error) => ({
        ...error,
        message: error.message.replace('redacted', 'sneaky'),
      }),
    ],
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.captureError(new Error('Error with secret info'));
  telemetry.register(mockClient);

  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:error',
    expect.objectContaining({
      message: 'Error with sneaky info',
    }),
  );
});

it('handles error filter throwing an exception', () => {
  const mockLogger = {
    warn: jest.fn(),
  };
  const options: ParsedOptions = {
    ...defaultOptions,
    errorFilters: [
      () => {
        throw new Error('Filter error');
      },
    ],
    logger: mockLogger,
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.captureError(new Error('Test error'));
  telemetry.register(mockClient);

  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Error applying error filters: Error: Filter error',
  );
  // Verify only session init event was tracked
  expect(mockClient.track).toHaveBeenCalledTimes(1);
  expect(mockClient.track).toHaveBeenCalledWith(
    '$ld:telemetry:session:init',
    expect.objectContaining({
      sessionId: expect.any(String),
    }),
  );
});

it('only logs error filter error once', () => {
  const mockLogger = {
    warn: jest.fn(),
  };
  const options: ParsedOptions = {
    ...defaultOptions,
    errorFilters: [
      () => {
        throw new Error('Filter error');
      },
    ],
    logger: mockLogger,
  };
  const telemetry = new BrowserTelemetryImpl(options);

  telemetry.captureError(new Error('Error 1'));
  telemetry.captureError(new Error('Error 2'));

  expect(mockLogger.warn).toHaveBeenCalledTimes(1);
});
