import { FDv2PollResponse, FDv2Requestor } from '../../../src/datasource/fdv2/FDv2Requestor';
import { createPollingInitializer } from '../../../src/datasource/fdv2/PollingInitializer';
import { makeHeaders, makeLogger, makeSuccessResponse } from './testHelpers';

const logger = makeLogger();

beforeEach(() => {
  jest.clearAllMocks();
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

it('returns terminal error on unrecoverable HTTP error', async () => {
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
});

it('returns terminal error on network error (oneShot mode)', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockRejectedValue(new Error('network failure')),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
  }
});

it('returns terminal error on recoverable HTTP error (oneShot mode)', async () => {
  const requestor: FDv2Requestor = {
    poll: jest.fn().mockResolvedValue({
      status: 500,
      headers: makeHeaders(),
      body: null,
    }),
  };

  const initializer = createPollingInitializer(requestor, logger, () => undefined);
  const result = await initializer.run();

  // In oneShot mode, even recoverable errors are terminal
  expect(result.type).toBe('status');
  if (result.type === 'status') {
    expect(result.state).toBe('terminal_error');
  }
});
