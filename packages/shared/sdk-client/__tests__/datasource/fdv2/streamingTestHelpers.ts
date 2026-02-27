import { LDLogger, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

import { createStreamingBase, PingHandler } from '../../../src/datasource/fdv2/StreamingFDv2Base';

export const serviceEndpoints: ServiceEndpoints = {
  events: '',
  polling: '',
  streaming: 'https://mockstream.ld.com',
  diagnosticEventPath: '/diagnostic',
  analyticsEventPath: '/bulk',
  includeAuthorizationHeader: true,
  payloadFilterKey: undefined,
};

export const baseHeaders = {
  authorization: 'test-sdk-key',
  'user-agent': 'TestUserAgent/2.0.2',
};

export type MockEventSource = ReturnType<typeof createMockEventSource>;
export type MockRequests = ReturnType<typeof createMockRequests>;

export function createMockEventSource() {
  return {
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn() as any,
    onerror: jest.fn() as any,
    onopen: jest.fn() as any,
    onretrying: jest.fn() as any,
  };
}

export function createMockRequests(mockEventSource: MockEventSource) {
  return {
    createEventSource: jest.fn((_uri: string, _options: any) => mockEventSource),
    getEventSourceCapabilities: jest.fn(() => ({
      readTimeout: true,
      headers: true,
      customMethod: true,
    })),
    fetch: jest.fn(),
  };
}

export function createMockLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Simulate an FDv2 event on a mock event source by finding and invoking
 * the registered listener for the given event name.
 */
export function simulateEvent(mockEventSource: MockEventSource, eventName: string, data: any) {
  const { calls } = mockEventSource.addEventListener.mock;
  const listener = calls.find((c: any[]) => c[0] === eventName)?.[1];
  if (!listener) {
    throw new Error(`No listener registered for event "${eventName}"`);
  }
  listener({ data: JSON.stringify(data) });
}

/**
 * Send a complete FDv2 full transfer sequence
 * (server-intent + put-objects + payload-transferred).
 */
export function sendFullTransfer(
  mockEventSource: MockEventSource,
  flags: Array<{ key: string; version: number; value: any }>,
  payloadId = 'test-payload',
  payloadVersion = 1,
  state = '(p:test:1)',
) {
  simulateEvent(mockEventSource, 'server-intent', {
    payloads: [{ intentCode: 'xfer-full', id: payloadId, target: payloadVersion, reason: 'test' }],
  });

  flags.forEach((flag) => {
    simulateEvent(mockEventSource, 'put-object', {
      kind: 'flagEval',
      key: flag.key,
      version: flag.version,
      object: { value: flag.value, trackEvents: false },
    });
  });

  simulateEvent(mockEventSource, 'payload-transferred', {
    state,
    version: payloadVersion,
  });
}

export function simulateErrorFilter(
  mockRequests: MockRequests,
  error: { status: number; message: string; headers?: Record<string, string> },
): boolean {
  const createCall = mockRequests.createEventSource.mock.calls[0];
  const options = createCall[1];
  return options.errorFilter(error);
}

/**
 * Create a {@link StreamingFDv2Base} wired to the given mock requests.
 */
export function createBase(
  mockRequests: MockRequests,
  logger: LDLogger,
  options: {
    pingHandler?: PingHandler;
    streamUriPath?: string;
    parameters?: { key: string; value: string }[];
  } = {},
) {
  return createStreamingBase({
    requests: mockRequests as any,
    serviceEndpoints,
    streamUriPath: options.streamUriPath ?? '/sdk/stream/eval/test-context',
    parameters: options.parameters ?? [],
    headers: baseHeaders,
    initialRetryDelayMillis: 1000,
    logger,
    pingHandler: options.pingHandler,
  });
}
