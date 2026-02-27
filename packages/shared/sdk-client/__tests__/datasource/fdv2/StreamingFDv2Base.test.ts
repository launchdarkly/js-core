import { LDLogger } from '@launchdarkly/js-sdk-common';

import { PingHandler } from '../../../src/datasource/fdv2/StreamingFDv2Base';
import {
  createBase,
  createMockEventSource,
  createMockLogger,
  createMockRequests,
  sendFullTransfer,
  serviceEndpoints,
  simulateErrorFilter,
  simulateEvent,
} from './streamingTestHelpers';

let logger: LDLogger;

beforeEach(() => {
  logger = createMockLogger();
});

it('creates EventSource with correct URI and options', () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);

  const base = createBase(mockRequests, logger, {
    streamUriPath: '/sdk/stream/eval/ctx',
    parameters: [{ key: 'withReasons', value: 'true' }],
  });
  base.start();

  expect(mockRequests.createEventSource).toHaveBeenCalledWith(
    `${serviceEndpoints.streaming}/sdk/stream/eval/ctx?withReasons=true`,
    expect.objectContaining({
      initialRetryDelayMillis: 1000,
      readTimeoutMillis: 300000,
      retryResetIntervalMillis: 60000,
      errorFilter: expect.any(Function),
    }),
  );
});

it('produces a changeSet result for a full transfer', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  sendFullTransfer(mockEventSource, [{ key: 'my-flag', version: 5, value: 'green' }]);

  const result = await base.takeResult();
  expect(result.type).toBe('changeSet');
  if (result.type !== 'changeSet') return;

  expect(result.payload.type).toBe('full');
  expect(result.payload.updates).toHaveLength(1);
  expect(result.payload.updates[0].key).toBe('my-flag');
  expect(result.payload.updates[0].object.value).toBe('green');
  expect(result.fdv1Fallback).toBe(false);

  base.close();
});

it('produces a partial changeSet for incremental updates', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  sendFullTransfer(mockEventSource, [{ key: 'flag-a', version: 1, value: true }]);
  await base.takeResult();

  simulateEvent(mockEventSource, 'put-object', {
    kind: 'flagEval',
    key: 'flag-a',
    version: 2,
    object: { value: false, trackEvents: true },
  });
  simulateEvent(mockEventSource, 'delete-object', {
    kind: 'flagEval',
    key: 'flag-b',
    version: 3,
  });
  simulateEvent(mockEventSource, 'payload-transferred', {
    state: '(p:test:2)',
    version: 2,
  });

  const result = await base.takeResult();
  expect(result.type).toBe('changeSet');
  if (result.type !== 'changeSet') return;

  expect(result.payload.type).toBe('partial');
  expect(result.payload.updates).toHaveLength(2);
  expect(result.payload.updates[0]).toMatchObject({ key: 'flag-a', version: 2 });
  expect(result.payload.updates[1]).toMatchObject({ key: 'flag-b', version: 3, deleted: true });

  base.close();
});

it('produces a changeSet with type none for intent code none', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  simulateEvent(mockEventSource, 'server-intent', {
    payloads: [{ intentCode: 'none', id: 'p1', target: 1, reason: 'up-to-date' }],
  });

  const result = await base.takeResult();
  expect(result.type).toBe('changeSet');
  if (result.type !== 'changeSet') return;

  expect(result.payload.type).toBe('none');
  expect(result.payload.updates).toHaveLength(0);

  base.close();
});

it('produces a goodbye status result', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  simulateEvent(mockEventSource, 'goodbye', {
    reason: 'server restarting',
    silent: false,
    catastrophe: false,
  });

  const result = await base.takeResult();
  expect(result.type).toBe('status');
  if (result.type !== 'status') return;

  expect(result.state).toBe('goodbye');
  expect(result.reason).toBe('server restarting');

  base.close();
});

it('ignores heart-beat events without queuing results', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  simulateEvent(mockEventSource, 'heart-beat', {});

  sendFullTransfer(mockEventSource, [{ key: 'flag', version: 1, value: true }]);

  const result = await base.takeResult();
  expect(result.type).toBe('changeSet');

  base.close();
});

it('silently ignores unrecognized object kinds', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  simulateEvent(mockEventSource, 'server-intent', {
    payloads: [{ intentCode: 'xfer-full', id: 'p1', target: 1, reason: 'test' }],
  });
  simulateEvent(mockEventSource, 'put-object', {
    kind: 'flagEval',
    key: 'known',
    version: 1,
    object: { value: true, trackEvents: false },
  });
  simulateEvent(mockEventSource, 'put-object', {
    kind: 'unknown_kind',
    key: 'mystery',
    version: 1,
    object: { data: 'ignored' },
  });
  simulateEvent(mockEventSource, 'payload-transferred', { state: '(p:p1:1)', version: 1 });

  const result = await base.takeResult();
  expect(result.type).toBe('changeSet');
  if (result.type !== 'changeSet') return;

  expect(result.payload.updates).toHaveLength(1);
  expect(result.payload.updates[0].key).toBe('known');

  base.close();
});

it('produces interrupted status for malformed JSON in event data', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  const { calls } = mockEventSource.addEventListener.mock;
  const listener = calls.find((c: any[]) => c[0] === 'server-intent')?.[1];
  listener({ data: 'not-valid-json{{{' });

  const result = await base.takeResult();
  expect(result.type).toBe('status');
  if (result.type !== 'status') return;

  expect(result.state).toBe('interrupted');
  expect(result.errorInfo?.message).toContain('Malformed JSON');

  base.close();
});

describe.each([408, 429, 500, 503])('given recoverable HTTP error %d', (status) => {
  it('retries and produces interrupted status', async () => {
    const mockEventSource = createMockEventSource();
    const mockRequests = createMockRequests(mockEventSource);
    const base = createBase(mockRequests, logger);
    base.start();

    const willRetry = simulateErrorFilter(mockRequests, {
      status,
      message: `Error ${status}`,
    });

    expect(willRetry).toBe(true);

    const result = await base.takeResult();
    expect(result.type).toBe('status');
    if (result.type !== 'status') return;

    expect(result.state).toBe('interrupted');

    base.close();
  });
});

describe.each([401, 403])('given irrecoverable HTTP error %d', (status) => {
  it('stops and produces terminal_error status', async () => {
    const mockEventSource = createMockEventSource();
    const mockRequests = createMockRequests(mockEventSource);
    const base = createBase(mockRequests, logger);
    base.start();

    const willRetry = simulateErrorFilter(mockRequests, {
      status,
      message: `Error ${status}`,
    });

    expect(willRetry).toBe(false);

    const result = await base.takeResult();
    expect(result.type).toBe('status');
    if (result.type !== 'status') return;

    expect(result.state).toBe('terminal_error');
    expect(result.errorInfo?.statusCode).toBe(status);

    base.close();
  });
});

it('detects x-ld-fd-fallback header and sets fdv1Fallback', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  const willRetry = simulateErrorFilter(mockRequests, {
    status: 200,
    message: 'fallback',
    headers: { 'x-ld-fd-fallback': 'true' },
  });

  expect(willRetry).toBe(false);

  const result = await base.takeResult();
  expect(result.type).toBe('status');
  if (result.type !== 'status') return;

  expect(result.state).toBe('terminal_error');
  expect(result.fdv1Fallback).toBe(true);

  base.close();
});

it('resets protocol handler on reconnection (onopen)', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  simulateEvent(mockEventSource, 'server-intent', {
    payloads: [{ intentCode: 'xfer-full', id: 'p1', target: 1, reason: 'test' }],
  });
  simulateEvent(mockEventSource, 'put-object', {
    kind: 'flagEval',
    key: 'flag-a',
    version: 1,
    object: { value: true, trackEvents: false },
  });

  mockEventSource.onopen();

  sendFullTransfer(mockEventSource, [{ key: 'flag-b', version: 2, value: 'blue' }]);

  const result = await base.takeResult();
  expect(result.type).toBe('changeSet');
  if (result.type !== 'changeSet') return;

  expect(result.payload.updates).toHaveLength(1);
  expect(result.payload.updates[0].key).toBe('flag-b');

  base.close();
});

it('handles ping events by calling ping handler and queuing the result', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);

  const pingResult = {
    type: 'changeSet' as const,
    payload: {
      id: 'p1',
      version: 1,
      state: '(p:p1:1)',
      type: 'full' as const,
      updates: [{ kind: 'flagEval', key: 'ping-flag', version: 1, object: { value: 'from-ping' } }],
    },
    fdv1Fallback: false,
  };

  const pingHandler: PingHandler = {
    handlePing: jest.fn().mockResolvedValue(pingResult),
  };

  const base = createBase(mockRequests, logger, { pingHandler });
  base.start();

  const { calls } = mockEventSource.addEventListener.mock;
  const pingListener = calls.find((c: any[]) => c[0] === 'ping')?.[1];
  expect(pingListener).toBeDefined();
  await pingListener();

  const result = await base.takeResult();
  expect(result).toEqual(pingResult);

  base.close();
});

it('produces interrupted status when ping handler throws', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);

  const pingHandler: PingHandler = {
    handlePing: jest.fn().mockRejectedValue(new Error('network error')),
  };

  const base = createBase(mockRequests, logger, { pingHandler });
  base.start();

  const { calls } = mockEventSource.addEventListener.mock;
  const pingListener = calls.find((c: any[]) => c[0] === 'ping')?.[1];
  await pingListener();

  const result = await base.takeResult();
  expect(result.type).toBe('status');
  if (result.type !== 'status') return;

  expect(result.state).toBe('interrupted');
  expect(result.errorInfo?.message).toContain('network error');

  base.close();
});

it('warns when ping event received without handler', () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  const { calls } = mockEventSource.addEventListener.mock;
  const pingListener = calls.find((c: any[]) => c[0] === 'ping')?.[1];
  pingListener();

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no ping handler'));

  base.close();
});

it('skips events received after close', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();
  base.close();

  const result = await base.takeResult();
  expect(result.type).toBe('status');
  if (result.type !== 'status') return;
  expect(result.state).toBe('shutdown');

  simulateEvent(mockEventSource, 'server-intent', {
    payloads: [{ intentCode: 'xfer-full', id: 'p1', target: 1, reason: 'test' }],
  });

  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('after processor was closed'));
});

it('produces results in order', async () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  sendFullTransfer(mockEventSource, [{ key: 'flag-1', version: 1, value: 'first' }]);

  simulateEvent(mockEventSource, 'goodbye', {
    reason: 'bye',
    silent: false,
    catastrophe: false,
  });

  const r1 = await base.takeResult();
  expect(r1.type).toBe('changeSet');

  const r2 = await base.takeResult();
  expect(r2.type).toBe('status');
  if (r2.type === 'status') {
    expect(r2.state).toBe('goodbye');
  }

  base.close();
});

it('close is idempotent', () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.start();

  base.close();
  base.close();

  expect(mockEventSource.close).toHaveBeenCalledTimes(1);
});

it('start after close is a no-op', () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);
  base.close();
  base.start();

  expect(mockRequests.createEventSource).not.toHaveBeenCalled();
});

it('calling start twice does not create a second EventSource', () => {
  const mockEventSource = createMockEventSource();
  const mockRequests = createMockRequests(mockEventSource);
  const base = createBase(mockRequests, logger);

  base.start();
  base.start();

  expect(mockRequests.createEventSource).toHaveBeenCalledTimes(1);

  base.close();
});
