import { LDLogger, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

import { createStreamingBase } from '../../../src/datasource/fdv2/StreamingFDv2Base';
import { createStreamingInitializer } from '../../../src/datasource/fdv2/StreamingInitializerFDv2';

let logger: LDLogger;

const serviceEndpoints: ServiceEndpoints = {
  events: '',
  polling: '',
  streaming: 'https://mockstream.ld.com',
  diagnosticEventPath: '/diagnostic',
  analyticsEventPath: '/bulk',
  includeAuthorizationHeader: true,
  payloadFilterKey: undefined,
};

function createMockEventSource() {
  return {
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn() as any,
    onerror: jest.fn() as any,
    onopen: jest.fn() as any,
    onretrying: jest.fn() as any,
  };
}

function simulateEvent(
  mockEventSource: ReturnType<typeof createMockEventSource>,
  eventName: string,
  data: any,
) {
  const { calls } = mockEventSource.addEventListener.mock;
  const listener = calls.find((c: any[]) => c[0] === eventName)?.[1];
  if (listener) {
    listener({ data: JSON.stringify(data) });
  }
}

function sendFullTransfer(mockEventSource: ReturnType<typeof createMockEventSource>) {
  simulateEvent(mockEventSource, 'server-intent', {
    payloads: [{ intentCode: 'xfer-full', id: 'p1', target: 1, reason: 'test' }],
  });
  simulateEvent(mockEventSource, 'put-object', {
    kind: 'flagEval',
    key: 'test-flag',
    version: 1,
    object: { value: true, trackEvents: false },
  });
  simulateEvent(mockEventSource, 'payload-transferred', {
    state: '(p:p1:1)',
    version: 1,
  });
}

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

it('returns the first changeSet result and closes the connection', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = {
    createEventSource: jest.fn(() => mockEventSource),
    getEventSourceCapabilities: jest.fn(() => ({
      readTimeout: true,
      headers: true,
      customMethod: true,
    })),
    fetch: jest.fn(),
  };

  const base = createStreamingBase({
    requests: mockRequests as any,
    serviceEndpoints,
    streamUriPath: '/sdk/stream/eval/ctx',
    parameters: [],
    headers: { authorization: 'test' },
    initialRetryDelayMillis: 1000,
    logger,
  });

  const initializer = createStreamingInitializer(base);

  const runPromise = initializer.run();
  sendFullTransfer(mockEventSource);

  const result = await runPromise;
  expect(result.type).toBe('changeSet');
  if (result.type === 'changeSet') {
    expect(result.payload.updates[0].key).toBe('test-flag');
  }

  // Connection should be closed.
  expect(mockEventSource.close).toHaveBeenCalled();
});

it('returns error status if connection fails', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = {
    createEventSource: jest.fn((_uri: string, options: any) => {
      // Simulate an irrecoverable error immediately.
      setTimeout(() => {
        options.errorFilter({ status: 401, message: 'Unauthorized' });
      }, 0);
      return mockEventSource;
    }),
    getEventSourceCapabilities: jest.fn(() => ({
      readTimeout: true,
      headers: true,
      customMethod: true,
    })),
    fetch: jest.fn(),
  };

  const base = createStreamingBase({
    requests: mockRequests as any,
    serviceEndpoints,
    streamUriPath: '/sdk/stream/eval/ctx',
    parameters: [],
    headers: { authorization: 'test' },
    initialRetryDelayMillis: 1000,
    logger,
  });

  const initializer = createStreamingInitializer(base);
  const result = await initializer.run();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
  }
});

it('close before run completes returns shutdown', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = {
    createEventSource: jest.fn(() => mockEventSource),
    getEventSourceCapabilities: jest.fn(() => ({
      readTimeout: true,
      headers: true,
      customMethod: true,
    })),
    fetch: jest.fn(),
  };

  const base = createStreamingBase({
    requests: mockRequests as any,
    serviceEndpoints,
    streamUriPath: '/sdk/stream/eval/ctx',
    parameters: [],
    headers: { authorization: 'test' },
    initialRetryDelayMillis: 1000,
    logger,
  });

  const initializer = createStreamingInitializer(base);
  const runPromise = initializer.run();

  // Close before any events arrive.
  initializer.close();

  const result = await runPromise;
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
});

it('run after close returns shutdown immediately', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = {
    createEventSource: jest.fn(() => mockEventSource),
    getEventSourceCapabilities: jest.fn(() => ({
      readTimeout: true,
      headers: true,
      customMethod: true,
    })),
    fetch: jest.fn(),
  };

  const base = createStreamingBase({
    requests: mockRequests as any,
    serviceEndpoints,
    streamUriPath: '/sdk/stream/eval/ctx',
    parameters: [],
    headers: { authorization: 'test' },
    initialRetryDelayMillis: 1000,
    logger,
  });

  const initializer = createStreamingInitializer(base);
  initializer.close();

  const result = await initializer.run();
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
});
