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

type MockListener = (event?: { data?: string }) => void;

export function createMockEventSource() {
  // Live registry of the addEventListener registrations. The on* slots are independent of it:
  // assigning a slot never adds to or removes from the registry.
  const registry = new Map<string, MockListener[]>();

  // `listener` is typed `any` here (not `MockListener`) so existing call sites that reach
  // into `addEventListener.mock.calls` directly keep getting a loosely-typed tuple, matching
  // this file's pre-existing convention of invoking mock listeners with whatever shape a given
  // test needs.
  const addEventListener = jest.fn((type: string, listener: any) => {
    const current = registry.get(type) ?? [];
    current.push(listener);
    registry.set(type, current);
  });

  // Typed as `any` (matching this file's existing `jest.fn() as any` convention for these
  // members) so tests can keep invoking them directly with whatever event shape they need.
  let assignedOnClose: any;
  let assignedOnError: any;
  let assignedOnOpen: any;
  let assignedOnRetrying: any;
  let closed = false;

  return {
    addEventListener,
    // close() invokes the onclose slot once, then dispatches 'closed' to the registered
    // listeners, and does nothing on a later call.
    close: jest.fn(() => {
      if (closed) {
        return;
      }
      closed = true;
      try {
        assignedOnClose?.();
      } finally {
        (registry.get('closed') ?? []).forEach((listener) => listener());
      }
    }),
    listenersFor(type: string): MockListener[] {
      return registry.get(type) ?? [];
    },
    // Returns the slot that a dispatch of `type` invokes. There is no entry for 'closed':
    // onclose runs only from close(), never as part of a 'closed' dispatch.
    slotFor(type: string): any {
      switch (type) {
        case 'open':
          return assignedOnOpen;
        case 'error':
          return assignedOnError;
        case 'retrying':
          return assignedOnRetrying;
        default:
          return undefined;
      }
    },
    get onclose(): any {
      return assignedOnClose;
    },
    set onclose(listener: any) {
      assignedOnClose = listener;
    },
    get onerror(): any {
      return assignedOnError;
    },
    set onerror(listener: any) {
      assignedOnError = listener;
    },
    get onopen(): any {
      return assignedOnOpen;
    },
    set onopen(listener: any) {
      assignedOnOpen = listener;
    },
    get onretrying(): any {
      return assignedOnRetrying;
    },
    set onretrying(listener: any) {
      assignedOnRetrying = listener;
    },
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
 * Simulate an event on a mock event source: the matching on* slot is invoked first, then every
 * listener registered for the given event name. Throws when nothing would receive the event,
 * so a test fails loudly if a listener is lost.
 */
export function simulateEvent(mockEventSource: MockEventSource, eventName: string, data: any) {
  const slot = mockEventSource.slotFor(eventName);
  const listeners = mockEventSource.listenersFor(eventName);
  if (!slot && listeners.length === 0) {
    throw new Error(`No listener registered for event "${eventName}"`);
  }
  const event = { data: JSON.stringify(data) };
  slot?.(event);
  listeners.forEach((listener) => listener(event));
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
      kind: 'flag-eval',
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
    selectorGetter?: () => string | undefined;
  } = {},
) {
  return createStreamingBase({
    requests: mockRequests as any,
    serviceEndpoints,
    streamUriPath: options.streamUriPath ?? '/sdk/stream/eval/test-context',
    parameters: options.parameters ?? [],
    selectorGetter: options.selectorGetter,
    headers: baseHeaders,
    initialRetryDelayMillis: 1000,
    logger,
    pingHandler: options.pingHandler,
  });
}
