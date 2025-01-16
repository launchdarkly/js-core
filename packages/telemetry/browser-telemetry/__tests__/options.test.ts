import ErrorCollector from '../src/collectors/error';
import parse, { defaultOptions } from '../src/options';

const mockLogger = {
  warn: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('handles an empty configuration', () => {
  const outOptions = parse({});
  expect(outOptions).toEqual(defaultOptions());
});

it('can set all options at once', () => {
  const outOptions = parse({
    maxPendingEvents: 1,
    breadcrumbs: {
      maxBreadcrumbs: 1,
      click: false,
      evaluations: false,
      flagChange: false,
      filters: [(breadcrumb) => breadcrumb],
    },
    collectors: [new ErrorCollector(), new ErrorCollector()],
  });
  expect(outOptions).toEqual({
    maxPendingEvents: 1,
    breadcrumbs: {
      keyboardInput: true,
      maxBreadcrumbs: 1,
      click: false,
      evaluations: false,
      flagChange: false,
      http: {
        customUrlFilter: undefined,
        instrumentFetch: true,
        instrumentXhr: true,
      },
      filters: expect.any(Array),
    },
    stack: {
      source: {
        beforeLines: 3,
        afterLines: 3,
        maxLineLength: 280,
      },
    },
    collectors: [new ErrorCollector(), new ErrorCollector()],
  });
});

it('warns when maxPendingEvents is not a number', () => {
  const outOptions = parse(
    {
      // @ts-ignore
      maxPendingEvents: 'not a number',
    },
    mockLogger,
  );

  expect(outOptions.maxPendingEvents).toEqual(defaultOptions().maxPendingEvents);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "maxPendingEvents" should be of type number, got string, using default value',
  );
});

it('accepts valid maxPendingEvents number', () => {
  const outOptions = parse(
    {
      maxPendingEvents: 100,
    },
    mockLogger,
  );

  expect(outOptions.maxPendingEvents).toEqual(100);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('warns when breadcrumbs config is not an object', () => {
  const outOptions = parse(
    {
      // @ts-ignore
      breadcrumbs: 'not an object',
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs).toEqual(defaultOptions().breadcrumbs);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs" should be of type object, got string, using default value',
  );
});

it('warns when collectors is not an array', () => {
  const outOptions = parse(
    {
      // @ts-ignore
      collectors: 'not an array',
    },
    mockLogger,
  );

  expect(outOptions.collectors).toEqual(defaultOptions().collectors);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "collectors" should be of type Collector[], got string, using default value',
  );
});

it('accepts valid collectors array', () => {
  const collectors = [new ErrorCollector()];
  const outOptions = parse(
    {
      collectors,
    },
    mockLogger,
  );

  expect(outOptions.collectors).toEqual(collectors);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('warns when stack config is not an object', () => {
  const outOptions = parse(
    {
      // @ts-ignore
      stack: 'not an object',
    },
    mockLogger,
  );

  expect(outOptions.stack).toEqual(defaultOptions().stack);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "stack" should be of type object, got string, using default value',
  );
});

it('warns when breadcrumbs.maxBreadcrumbs is not a number', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        // @ts-ignore
        maxBreadcrumbs: 'not a number',
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.maxBreadcrumbs).toEqual(
    defaultOptions().breadcrumbs.maxBreadcrumbs,
  );
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.maxBreadcrumbs" should be of type number, got string, using default value',
  );
});

it('accepts valid breadcrumbs.maxBreadcrumbs number', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        maxBreadcrumbs: 50,
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.maxBreadcrumbs).toEqual(50);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('warns when breadcrumbs.click is not boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        // @ts-ignore
        click: 'not a boolean',
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.click).toEqual(defaultOptions().breadcrumbs.click);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.click" should be of type boolean, got string, using default value',
  );
});

it('warns when breadcrumbs.evaluations is not boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        // @ts-ignore
        evaluations: 'not a boolean',
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.evaluations).toEqual(defaultOptions().breadcrumbs.evaluations);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.evaluations" should be of type boolean, got string, using default value',
  );
});

it('warns when breadcrumbs.flagChange is not boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        // @ts-ignore
        flagChange: 'not a boolean',
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.flagChange).toEqual(defaultOptions().breadcrumbs.flagChange);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.flagChange" should be of type boolean, got string, using default value',
  );
});

it('warns when breadcrumbs.keyboardInput is not boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        // @ts-ignore
        keyboardInput: 'not a boolean',
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.keyboardInput).toEqual(defaultOptions().breadcrumbs.keyboardInput);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.keyboardInput" should be of type boolean, got string, using default value',
  );
});

it('accepts valid breadcrumbs.click boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        click: false,
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.click).toEqual(false);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('accepts valid breadcrumbs.evaluations boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        evaluations: false,
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.evaluations).toEqual(false);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('accepts valid breadcrumbs.flagChange boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        flagChange: false,
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.flagChange).toEqual(false);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('accepts valid breadcrumbs.keyboardInput boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        keyboardInput: false,
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.keyboardInput).toEqual(false);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('warns when breadcrumbs.http is not an object', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        // @ts-ignore
        http: 'not an object',
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.http).toEqual(defaultOptions().breadcrumbs.http);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.http" should be of type HttpBreadCrumbOptions | false, got string, using default value',
  );
});

it('warns when breadcrumbs.http.instrumentFetch is not boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        http: {
          // @ts-ignore
          instrumentFetch: 'not a boolean',
        },
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.http.instrumentFetch).toEqual(
    defaultOptions().breadcrumbs.http.instrumentFetch,
  );
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.http.instrumentFetch" should be of type boolean, got string, using default value',
  );
});

it('warns when breadcrumbs.http.instrumentXhr is not boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        http: {
          // @ts-ignore
          instrumentXhr: 'not a boolean',
        },
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.http.instrumentXhr).toEqual(
    defaultOptions().breadcrumbs.http.instrumentXhr,
  );
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.http.instrumentXhr" should be of type boolean, got string, using default value',
  );
});

it('accepts valid breadcrumbs.http.instrumentFetch boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        http: {
          instrumentFetch: false,
        },
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.http.instrumentFetch).toEqual(false);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('accepts valid breadcrumbs.http.instrumentXhr boolean', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        http: {
          instrumentXhr: false,
        },
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.http.instrumentXhr).toEqual(false);
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('accepts valid breadcrumbs.http.customUrlFilter function', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        http: {
          customUrlFilter: (url: string) => url.replace('secret', 'redacted'),
        },
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.http.customUrlFilter).toBeDefined();
  expect(outOptions.breadcrumbs.http.customUrlFilter?.('test-secret-123')).toBe(
    'test-redacted-123',
  );
  expect(mockLogger.warn).not.toHaveBeenCalled();
});

it('warns when breadcrumbs.http.customUrlFilter is not a function', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        http: {
          // @ts-ignore
          customUrlFilter: 'not a function',
        },
      },
    },
    mockLogger,
  );

  expect(outOptions.breadcrumbs.http.customUrlFilter).toBeUndefined();
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: The "breadcrumbs.http.customUrlFilter" must be a function. Received string',
  );
});

it('warns when filters is not an array', () => {
  const outOptions = parse(
    {
      breadcrumbs: {
        // @ts-ignore
        filters: 'not an array',
      },
    },
    mockLogger,
  );
  expect(outOptions.breadcrumbs.filters).toEqual([]);
  expect(mockLogger.warn).toHaveBeenCalledWith(
    'LaunchDarkly - Browser Telemetry: Config option "breadcrumbs.filters" should be of type array, got string, using default value',
  );
});
