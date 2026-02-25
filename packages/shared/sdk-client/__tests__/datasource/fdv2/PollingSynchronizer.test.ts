import { FDv2PollResponse, FDv2Requestor } from '../../../src/datasource/fdv2/FDv2Requestor';
import { createPollingSynchronizer } from '../../../src/datasource/fdv2/PollingSynchronizer';

function makeHeaders(extra: Record<string, string> = {}): { get(name: string): string | null } {
  const headers: Record<string, string> = { ...extra };
  return {
    get(name: string): string | null {
      return headers[name.toLowerCase()] ?? null;
    },
  };
}

function makeFullPayloadBody(
  flags: Record<string, { value: any; trackEvents?: boolean }>,
  state: string = 'test-state',
): string {
  const events: any[] = [
    {
      event: 'server-intent',
      data: {
        payloads: [{ id: 'test-payload', target: 1, intentCode: 'xfer-full', reason: 'test' }],
      },
    },
  ];

  Object.entries(flags).forEach(([key, flag]) => {
    events.push({
      event: 'put-object',
      data: {
        kind: 'flagEval',
        key,
        version: 1,
        object: { value: flag.value, trackEvents: flag.trackEvents ?? false },
      },
    });
  });

  events.push({
    event: 'payload-transferred',
    data: { state, version: 1, id: 'test-payload' },
  });

  return JSON.stringify({ events });
}

function makeSuccessResponse(
  flags: Record<string, { value: any }>,
  state: string = 'test-state',
): FDv2PollResponse {
  return {
    status: 200,
    headers: makeHeaders(),
    body: makeFullPayloadBody(flags, state),
  };
}

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

it('returns a result from the first poll immediately', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue(makeSuccessResponse({ flagA: { value: true } })),
  };

  const synchronizer = createPollingSynchronizer(requestor, logger, () => undefined, 30000);

  // Flush the immediate poll
  await jest.advanceTimersByTimeAsync(0);

  const result = await synchronizer.next();
  expect(result.type).toBe('changeSet');

  synchronizer.close();
});

it('returns successive results from periodic polling', async () => {
  let callCount = 0;
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(
        makeSuccessResponse({ flag: { value: callCount } }, `state-${callCount}`),
      );
    }),
  };

  const synchronizer = createPollingSynchronizer(requestor, logger, () => undefined, 1000);

  // First poll (immediate)
  await jest.advanceTimersByTimeAsync(0);
  const result1 = await synchronizer.next();
  expect(result1.type).toBe('changeSet');
  if (result1.type === 'changeSet') {
    expect(result1.payload.state).toBe('state-1');
  }

  // Second poll (after interval)
  await jest.advanceTimersByTimeAsync(1000);
  const result2 = await synchronizer.next();
  expect(result2.type).toBe('changeSet');
  if (result2.type === 'changeSet') {
    expect(result2.payload.state).toBe('state-2');
  }

  synchronizer.close();
});

it('returns shutdown on close', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue(makeSuccessResponse({ flagA: { value: true } })),
  };

  const synchronizer = createPollingSynchronizer(requestor, logger, () => undefined, 30000);

  // Flush the immediate poll
  await jest.advanceTimersByTimeAsync(0);

  // Consume the first result
  await synchronizer.next();

  // Close the synchronizer
  synchronizer.close();

  const result = await synchronizer.next();
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
});

it('stops polling on terminal error', async () => {
  let callCount = 0;
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve(makeSuccessResponse({ flag: { value: 1 } }));
      }
      // Second call returns unrecoverable error
      return Promise.resolve({
        status: 401,
        headers: makeHeaders(),
        body: null,
      });
    }),
  };

  const synchronizer = createPollingSynchronizer(requestor, logger, () => undefined, 1000);

  // First poll (success)
  await jest.advanceTimersByTimeAsync(0);
  const result1 = await synchronizer.next();
  expect(result1.type).toBe('changeSet');

  // Second poll (terminal error) — should resolve via shutdown future
  await jest.advanceTimersByTimeAsync(1000);
  const result2 = await synchronizer.next();
  expect(result2.type).toBe('status');
  if (result2.type === 'status') {
    expect(result2.state).toBe('terminal_error');
  }

  // No more polls should happen
  const pollCountBefore = (requestor.poll as jest.Mock).mock.calls.length;
  await jest.advanceTimersByTimeAsync(5000);
  const pollCountAfter = (requestor.poll as jest.Mock).mock.calls.length;
  expect(pollCountAfter).toBe(pollCountBefore);
});

it('continues polling on interrupted (recoverable) error', async () => {
  let callCount = 0;
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        // First call: recoverable error
        return Promise.resolve({
          status: 500,
          headers: makeHeaders(),
          body: null,
        });
      }
      // Second call: success
      return Promise.resolve(makeSuccessResponse({ flag: { value: 1 } }));
    }),
  };

  const synchronizer = createPollingSynchronizer(requestor, logger, () => undefined, 1000);

  // First poll (interrupted)
  await jest.advanceTimersByTimeAsync(0);
  const result1 = await synchronizer.next();
  expect(result1.type).toBe('status');
  if (result1.type === 'status') {
    expect(result1.state).toBe('interrupted');
  }

  // Second poll (success) — should still be polling
  await jest.advanceTimersByTimeAsync(1000);
  const result2 = await synchronizer.next();
  expect(result2.type).toBe('changeSet');

  synchronizer.close();
});

it('passes the selector from selectorGetter to each poll', async () => {
  let currentSelector: string | undefined = 'initial-selector';
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue(makeSuccessResponse({ flag: { value: 1 } })),
  };

  const synchronizer = createPollingSynchronizer(requestor, logger, () => currentSelector, 1000);

  // First poll
  await jest.advanceTimersByTimeAsync(0);
  await synchronizer.next();
  expect(requestor.poll).toHaveBeenCalledWith('initial-selector');

  // Update the selector
  currentSelector = 'updated-selector';

  // Second poll
  await jest.advanceTimersByTimeAsync(1000);
  await synchronizer.next();
  expect(requestor.poll).toHaveBeenCalledWith('updated-selector');

  synchronizer.close();
});

it('handles 304 responses as changeSet with type none', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue({
      status: 304,
      headers: makeHeaders(),
      body: null,
    }),
  };

  const synchronizer = createPollingSynchronizer(requestor, logger, () => 'some-state', 30000);

  await jest.advanceTimersByTimeAsync(0);
  const result = await synchronizer.next();

  expect(result.type).toBe('changeSet');
  if (result.type === 'changeSet') {
    expect(result.payload.type).toBe('none');
  }

  synchronizer.close();
});
