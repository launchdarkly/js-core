import { createFDv1PollingSynchronizer } from '../../../src/datasource/fdv2/FDv1PollingSynchronizer';
import { LDRequestError, Requestor } from '../../../src/datasource/Requestor';
import { makeLogger } from './testHelpers';

const logger = makeLogger();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

function makeFDv1Requestor(response: string): Requestor {
  return {
    requestPayload: jest.fn().mockResolvedValue(response),
  };
}

function makeFDv1Flags(flags: Record<string, { value: any; version?: number }>) {
  const result: Record<string, any> = {};
  Object.entries(flags).forEach(([key, flag]) => {
    result[key] = { version: flag.version ?? 1, value: flag.value };
  });
  return JSON.stringify(result);
}

it('does not poll until the first call to next', async () => {
  const requestor = makeFDv1Requestor(makeFDv1Flags({ flagA: { value: true } }));
  const sync = createFDv1PollingSynchronizer(requestor, 30000, logger);

  // Advance time — should not have polled yet
  await jest.advanceTimersByTimeAsync(0);
  expect(requestor.requestPayload).not.toHaveBeenCalled();

  // First next() triggers the poll
  const nextPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);

  const result = await nextPromise;
  expect(requestor.requestPayload).toHaveBeenCalledTimes(1);
  expect(result.type).toBe('changeSet');

  sync.close();
});

it('produces a changeSet with full payload from a successful poll', async () => {
  const flags = { flagA: { value: 'yes', version: 5 }, flagB: { value: 42, version: 3 } };
  const requestor = makeFDv1Requestor(makeFDv1Flags(flags));
  const sync = createFDv1PollingSynchronizer(requestor, 30000, logger);

  const nextPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);

  const result = await nextPromise;
  expect(result.type).toBe('changeSet');
  if (result.type === 'changeSet') {
    expect(result.payload.type).toBe('full');
    expect(result.payload.version).toBe(1);
    expect(result.payload.updates).toHaveLength(2);

    const flagAUpdate = result.payload.updates.find((u) => u.key === 'flagA');
    expect(flagAUpdate).toEqual({
      kind: 'flag',
      key: 'flagA',
      version: 5,
      object: { version: 5, value: 'yes' },
    });

    const flagBUpdate = result.payload.updates.find((u) => u.key === 'flagB');
    expect(flagBUpdate).toEqual({
      kind: 'flag',
      key: 'flagB',
      version: 3,
      object: { version: 3, value: 42 },
    });
  }

  sync.close();
});

it('produces payloads without a selector', async () => {
  const requestor = makeFDv1Requestor(makeFDv1Flags({ flag: { value: true } }));
  const sync = createFDv1PollingSynchronizer(requestor, 30000, logger);

  const nextPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);

  const result = await nextPromise;
  expect(result.type).toBe('changeSet');
  if (result.type === 'changeSet') {
    expect(result.payload.state).toBeUndefined();
  }

  sync.close();
});

it('produces results with fdv1Fallback set to false', async () => {
  const requestor = makeFDv1Requestor(makeFDv1Flags({ flag: { value: true } }));
  const sync = createFDv1PollingSynchronizer(requestor, 30000, logger);

  const nextPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);

  const result = await nextPromise;
  expect(result.fdv1Fallback).toBe(false);

  sync.close();
});

it('returns shutdown when close is called', async () => {
  const requestor = makeFDv1Requestor(makeFDv1Flags({ flag: { value: true } }));
  const sync = createFDv1PollingSynchronizer(requestor, 30000, logger);

  // Start and consume the first result
  const firstPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  await firstPromise;

  // Close, then next should return shutdown
  sync.close();
  const result = await sync.next();
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
});

it('does not start polling when close is called before next', async () => {
  const requestor = makeFDv1Requestor(makeFDv1Flags({ flag: { value: true } }));
  const sync = createFDv1PollingSynchronizer(requestor, 30000, logger);

  sync.close();

  const result = await sync.next();
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }
  expect(requestor.requestPayload).not.toHaveBeenCalled();
});

it('produces interrupted on a recoverable HTTP error and continues polling', async () => {
  let callCount = 0;
  const requestor: Requestor = {
    requestPayload: jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new LDRequestError('Server error', 503));
      }
      return Promise.resolve(makeFDv1Flags({ flag: { value: 'recovered' } }));
    }),
  };

  const sync = createFDv1PollingSynchronizer(requestor, 1000, logger);

  // First poll — recoverable error
  const firstPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  const result1 = await firstPromise;
  expect(result1.type).toBe('status');
  if (result1.type === 'status') {
    expect(result1.state).toBe('interrupted');
    expect(result1.fdv1Fallback).toBe(false);
  }

  // Second poll — success after interval
  await jest.advanceTimersByTimeAsync(1000);
  const result2 = await sync.next();
  expect(result2.type).toBe('changeSet');

  sync.close();
});

it('produces terminal error on an unrecoverable HTTP error and stops polling', async () => {
  const requestor: Requestor = {
    requestPayload: jest.fn().mockRejectedValue(new LDRequestError('Unauthorized', 401)),
  };

  const sync = createFDv1PollingSynchronizer(requestor, 1000, logger);

  const nextPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  const result = await nextPromise;

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
    expect(result.fdv1Fallback).toBe(false);
  }

  // No more polls should happen
  const callCount = (requestor.requestPayload as jest.Mock).mock.calls.length;
  await jest.advanceTimersByTimeAsync(5000);
  expect((requestor.requestPayload as jest.Mock).mock.calls.length).toBe(callCount);
});

it('produces interrupted on invalid JSON and continues polling', async () => {
  let callCount = 0;
  const requestor: Requestor = {
    requestPayload: jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve('not valid json!!!');
      }
      return Promise.resolve(makeFDv1Flags({ flag: { value: true } }));
    }),
  };

  const sync = createFDv1PollingSynchronizer(requestor, 1000, logger);

  // First poll — invalid JSON
  const firstPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  const result1 = await firstPromise;
  expect(result1.type).toBe('status');
  if (result1.type === 'status') {
    expect(result1.state).toBe('interrupted');
  }

  // Second poll — valid response
  await jest.advanceTimersByTimeAsync(1000);
  const result2 = await sync.next();
  expect(result2.type).toBe('changeSet');

  sync.close();
});

it('produces interrupted on non-object JSON and continues polling', async () => {
  let callCount = 0;
  const requestor: Requestor = {
    requestPayload: jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve('null');
      }
      return Promise.resolve(makeFDv1Flags({ flag: { value: true } }));
    }),
  };

  const sync = createFDv1PollingSynchronizer(requestor, 1000, logger);

  // First poll — valid JSON but not an object
  const firstPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  const result1 = await firstPromise;
  expect(result1.type).toBe('status');
  if (result1.type === 'status') {
    expect(result1.state).toBe('interrupted');
    expect(result1.errorInfo?.kind).toBe('INVALID_DATA');
  }

  // Second poll — valid response
  await jest.advanceTimersByTimeAsync(1000);
  const result2 = await sync.next();
  expect(result2.type).toBe('changeSet');

  sync.close();
});

it('polls at the configured interval', async () => {
  let callCount = 0;
  const requestor: Requestor = {
    requestPayload: jest.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(makeFDv1Flags({ flag: { value: callCount } }));
    }),
  };

  const sync = createFDv1PollingSynchronizer(requestor, 5000, logger);

  // First poll (immediate on first next())
  const firstPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  await firstPromise;
  expect(requestor.requestPayload).toHaveBeenCalledTimes(1);

  // Not yet time for second poll
  await jest.advanceTimersByTimeAsync(3000);
  expect(requestor.requestPayload).toHaveBeenCalledTimes(1);

  // Second poll after interval
  await jest.advanceTimersByTimeAsync(2000);
  const result2 = await sync.next();
  expect(requestor.requestPayload).toHaveBeenCalledTimes(2);
  expect(result2.type).toBe('changeSet');

  sync.close();
});

it('returns successive results from periodic polling', async () => {
  let callCount = 0;
  const requestor: Requestor = {
    requestPayload: jest.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(
        JSON.stringify({ [`flag${callCount}`]: { version: callCount, value: callCount } }),
      );
    }),
  };

  const sync = createFDv1PollingSynchronizer(requestor, 1000, logger);

  // First poll
  const firstPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  const result1 = await firstPromise;
  expect(result1.type).toBe('changeSet');
  if (result1.type === 'changeSet') {
    expect(result1.payload.updates[0].key).toBe('flag1');
  }

  // Second poll
  await jest.advanceTimersByTimeAsync(1000);
  const result2 = await sync.next();
  expect(result2.type).toBe('changeSet');
  if (result2.type === 'changeSet') {
    expect(result2.payload.updates[0].key).toBe('flag2');
  }

  sync.close();
});

it('produces a network error as interrupted when requestor throws without status', async () => {
  let callCount = 0;
  const requestor: Requestor = {
    requestPayload: jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new LDRequestError('Network failure'));
      }
      return Promise.resolve(makeFDv1Flags({ flag: { value: true } }));
    }),
  };

  const sync = createFDv1PollingSynchronizer(requestor, 1000, logger);

  const firstPromise = sync.next();
  await jest.advanceTimersByTimeAsync(0);
  const result = await firstPromise;

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('interrupted');
    expect(result.errorInfo?.kind).toBe('NETWORK_ERROR');
  }

  sync.close();
});
