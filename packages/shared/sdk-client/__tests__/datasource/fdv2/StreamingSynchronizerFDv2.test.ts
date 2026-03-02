import { LDLogger } from '@launchdarkly/js-sdk-common';

import { createStreamingBase } from '../../../src/datasource/fdv2/StreamingFDv2Base';
import { createStreamingSynchronizer } from '../../../src/datasource/fdv2/StreamingSynchronizerFDv2';
import {
  createMockEventSource,
  createMockLogger,
  createMockRequests,
  sendFullTransfer,
  serviceEndpoints,
  simulateEvent,
} from './streamingTestHelpers';

let logger: LDLogger;

beforeEach(() => {
  logger = createMockLogger();
});

function createSynchronizer() {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);

  const base = createStreamingBase({
    requests: mockRequests as any,
    serviceEndpoints,
    streamUriPath: '/sdk/stream/eval/ctx',
    parameters: [],
    headers: { authorization: 'test' },
    initialRetryDelayMillis: 1000,
    logger,
  });

  const synchronizer = createStreamingSynchronizer(base);
  return { synchronizer, mockEventSource, mockRequests };
}

it('lazily starts connection on first next() call', () => {
  const { synchronizer, mockRequests } = createSynchronizer();

  expect(mockRequests.createEventSource).not.toHaveBeenCalled();

  synchronizer.next();
  expect(mockRequests.createEventSource).toHaveBeenCalledTimes(1);

  synchronizer.close();
});

it('does not create EventSource again on subsequent next() calls', () => {
  const { synchronizer, mockRequests, mockEventSource } = createSynchronizer();

  synchronizer.next();
  synchronizer.next();

  expect(mockRequests.createEventSource).toHaveBeenCalledTimes(1);

  sendFullTransfer(mockEventSource, [{ key: 'flag', version: 1, value: true }]);

  synchronizer.close();
});

it('returns successive changeSet results', async () => {
  const { synchronizer, mockEventSource } = createSynchronizer();

  const p1 = synchronizer.next();
  sendFullTransfer(mockEventSource, [{ key: 'flag-1', version: 1, value: 'first' }]);
  const r1 = await p1;

  expect(r1.type).toBe('changeSet');
  if (r1.type === 'changeSet') {
    expect(r1.payload.updates[0].key).toBe('flag-1');
  }

  const p2 = synchronizer.next();
  simulateEvent(mockEventSource, 'put-object', {
    kind: 'flagEval',
    key: 'flag-2',
    version: 2,
    object: { value: 'second', trackEvents: false },
  });
  simulateEvent(mockEventSource, 'payload-transferred', {
    state: '(p:p1:2)',
    version: 2,
  });
  const r2 = await p2;

  expect(r2.type).toBe('changeSet');
  if (r2.type === 'changeSet') {
    expect(r2.payload.updates[0].key).toBe('flag-2');
  }

  synchronizer.close();
});

it('close produces shutdown result', async () => {
  const { synchronizer, mockEventSource } = createSynchronizer();

  const p = synchronizer.next();
  synchronizer.close();

  const result = await p;
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }

  expect(mockEventSource.close).toHaveBeenCalled();
});

it('next after close returns shutdown immediately', async () => {
  const { synchronizer } = createSynchronizer();

  synchronizer.close();
  const result = await synchronizer.next();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
});

it('close is idempotent', () => {
  const { synchronizer, mockEventSource } = createSynchronizer();

  synchronizer.next();
  synchronizer.close();
  synchronizer.close();

  expect(mockEventSource.close).toHaveBeenCalledTimes(1);
});

it('propagates fdv1Fallback flag on results', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = {
    createEventSource: jest.fn((_uri: string, options: any) => {
      setTimeout(() => {
        options.errorFilter({
          status: 200,
          message: 'fallback',
          headers: { 'x-ld-fd-fallback': 'true' },
        });
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

  const synchronizer = createStreamingSynchronizer(base);
  const result = await synchronizer.next();

  expect(result.fdv1Fallback).toBe(true);

  synchronizer.close();
});
