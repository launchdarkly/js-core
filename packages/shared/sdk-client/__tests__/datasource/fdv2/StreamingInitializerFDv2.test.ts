import { LDLogger } from '@launchdarkly/js-sdk-common';

import { createStreamingBase } from '../../../src/datasource/fdv2/StreamingFDv2Base';
import { createStreamingInitializer } from '../../../src/datasource/fdv2/StreamingInitializerFDv2';
import {
  createMockEventSource,
  createMockLogger,
  createMockRequests,
  sendFullTransfer,
  serviceEndpoints,
} from './streamingTestHelpers';

let logger: LDLogger;

beforeEach(() => {
  logger = createMockLogger();
});

function createBaseAndInitializer(mockRequests?: ReturnType<typeof createMockRequests>) {
  const mockEventSource = createMockEventSource();
  const requests = mockRequests ?? createMockRequests(mockEventSource);

  const base = createStreamingBase({
    requests: requests as any,
    serviceEndpoints,
    streamUriPath: '/sdk/stream/eval/ctx',
    parameters: [],
    headers: { authorization: 'test' },
    initialRetryDelayMillis: 1000,
    logger,
  });

  const initializer = createStreamingInitializer(base);
  return { initializer, mockEventSource, mockRequests: requests };
}

it('returns the first changeSet result and closes the connection', async () => {
  const { initializer, mockEventSource } = createBaseAndInitializer();

  const runPromise = initializer.run();
  sendFullTransfer(mockEventSource, [{ key: 'test-flag', version: 1, value: true }]);

  const result = await runPromise;
  expect(result.type).toBe('changeSet');
  if (result.type === 'changeSet') {
    expect(result.payload.updates[0].key).toBe('test-flag');
  }

  expect(mockEventSource.close).toHaveBeenCalled();
});

it('returns error status if connection fails', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = {
    createEventSource: jest.fn((_uri: string, options: any) => {
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

  const { initializer } = createBaseAndInitializer(mockRequests as any);
  const result = await initializer.run();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
  }
});

it('close before run completes returns shutdown', async () => {
  const { initializer } = createBaseAndInitializer();

  const runPromise = initializer.run();
  initializer.close();

  const result = await runPromise;
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
});

it('run after close returns shutdown immediately', async () => {
  const { initializer } = createBaseAndInitializer();

  initializer.close();

  const result = await initializer.run();
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
});
