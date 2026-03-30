import { sleep } from '@launchdarkly/js-sdk-common';

import { FDv2PollResponse, FDv2Requestor } from '../../../src/datasource/fdv2/FDv2Requestor';
import { createPollingInitializer } from '../../../src/datasource/fdv2/PollingInitializer';
import { makeFDv2Body, makeHeaders, makeLogger, makeSuccessResponse } from './testHelpers';

jest.mock('@launchdarkly/js-sdk-common', () => ({
  ...jest.requireActual('@launchdarkly/js-sdk-common'),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

const logger = makeLogger();

beforeEach(() => {
  jest.clearAllMocks();
  (sleep as jest.Mock).mockResolvedValue(undefined);
});

it('returns a changeSet result on successful poll', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue(makeSuccessResponse({ flagA: { value: true } })),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('changeSet');
  if (result.type === 'changeSet') {
    expect(result.payload.type).toBe('full');
    expect(result.payload.updates).toHaveLength(1);
  }
  expect(requestor.poll).toHaveBeenCalledTimes(1);
});

it('passes the selector from selectorGetter to the poll', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue(makeSuccessResponse({ flagA: { value: true } })),
  };

  const initializer = createPollingInitializer(requestor, logger, () => 'my-selector');
  await initializer.run();

  expect(requestor.poll).toHaveBeenCalledWith('my-selector');
});

it('returns shutdown when close is called before poll completes', async () => {
  let resolveRequest!: (response: FDv2PollResponse) => void;
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockReturnValue(
      new Promise<FDv2PollResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    ),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const resultPromise = initializer.run();

  // Close before the poll resolves
  initializer.close();

  const result = await resultPromise;

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }

  // Clean up the pending request
  resolveRequest(makeSuccessResponse({}));
});

it('returns terminal error on unrecoverable HTTP error without retrying', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue({
      status: 401,
      headers: makeHeaders(),
      body: null,
    }),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
  }
  expect(requestor.poll).toHaveBeenCalledTimes(1);
});

it('retries on recoverable HTTP error and succeeds', async () => {
  const requestor: FDv2Requestor = {
    poll: jest
      .fn()
      .mockResolvedValueOnce({
        status: 500,
        headers: makeHeaders(),
        body: null,
      })
      .mockResolvedValueOnce(makeSuccessResponse({ flagA: { value: true } })),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('changeSet');
  expect(requestor.poll).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledTimes(1);
  expect(sleep).toHaveBeenCalledWith(1000);
});

it('retries on network error and succeeds', async () => {
  const requestor: FDv2Requestor = {
    poll: jest
      .fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(makeSuccessResponse({ flagA: { value: true } })),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('changeSet');
  expect(requestor.poll).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledTimes(1);
});

it('exhausts retries on recoverable error then returns terminal error', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue({
      status: 500,
      headers: makeHeaders(),
      body: null,
    }),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
    expect(result.errorInfo?.statusCode).toBe(500);
  }
  // 1 initial + 3 retries = 4 total
  expect(requestor.poll).toHaveBeenCalledTimes(4);
  expect(sleep).toHaveBeenCalledTimes(3);
});

it('exhausts retries on network error then returns terminal error', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockRejectedValue(new Error('network failure')),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
    expect(result.errorInfo?.message).toBe('network failure');
  }
  expect(requestor.poll).toHaveBeenCalledTimes(4);
});

it('does not retry on goodbye result', async () => {
  const body = makeFDv2Body([
    {
      event: 'server-intent',
      data: {
        payloads: [{ id: 'test', target: 1, intentCode: 'xfer-full', reason: 'test' }],
      },
    },
    {
      event: 'goodbye',
      data: { reason: 'server-shutdown', silent: false, catastrophe: false },
    },
  ]);
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue({
      status: 200,
      headers: makeHeaders(),
      body,
    }),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('goodbye');
  }
  expect(requestor.poll).toHaveBeenCalledTimes(1);
});

it('returns shutdown when close is called during retry delay', async () => {
  let sleepResolve!: () => void;
  // sleepCalled resolves when the code enters sleep, proving the first poll failed
  // and the retry delay has started — an observable effect, not a timing assumption.
  let sleepCalledResolve!: () => void;
  const sleepCalled = new Promise<void>((resolve) => {
    sleepCalledResolve = resolve;
  });

  (sleep as jest.Mock).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        sleepResolve = resolve;
        sleepCalledResolve();
      }),
  );

  const requestor: FDv2Requestor = {
    poll: jest.fn().mockRejectedValue(new Error('network failure')),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const resultPromise = initializer.run();

  // Wait until sleep is actually called (first poll failed, retry delay started)
  await sleepCalled;

  // Close during the retry delay
  initializer.close();

  const result = await resultPromise;

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('shutdown');
  }

  // Clean up
  sleepResolve();
});
