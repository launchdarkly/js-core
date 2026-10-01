import { LDLogger } from '@launchdarkly/node-server-sdk';

import DynamoDBCore from '../src/DynamoDBCore';

function makeLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

function accessDenied(): Error {
  const err = new Error('User is not authorized to perform: dynamodb:DeleteItem');
  err.name = 'AccessDeniedException';
  return err;
}

function makeState(deleteMock: jest.Mock) {
  return {
    prefixedKey: (key: string) => key,
    query: jest.fn().mockResolvedValue([]),
    delete: deleteMock,
    batchWrite: jest.fn().mockResolvedValue(undefined),
    put: jest.fn().mockResolvedValue(undefined),
  };
}

function initOnce(core: DynamoDBCore): Promise<Error | undefined> {
  return new Promise((resolve) => {
    core.init([], (err?: Error) => resolve(err));
  });
}

it('initializes without the token delete when the permission is missing', async () => {
  const logger = makeLogger();
  const deleteMock = jest.fn().mockRejectedValue(accessDenied());
  const state = makeState(deleteMock);
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state, logger);

  const err = await initOnce(core);

  expect(err).toBeUndefined();
  expect(state.batchWrite).toHaveBeenCalledTimes(1);
  expect(state.put).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain('dynamodb:DeleteItem');
  expect(logger.error).not.toHaveBeenCalled();
});

it('does not attempt the token delete again after a permission denial', async () => {
  const logger = makeLogger();
  const deleteMock = jest.fn().mockRejectedValue(accessDenied());
  const state = makeState(deleteMock);
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state, logger);

  await initOnce(core);
  await initOnce(core);

  expect(deleteMock).toHaveBeenCalledTimes(1);
  expect(state.batchWrite).toHaveBeenCalledTimes(2);
  expect(logger.warn).toHaveBeenCalledTimes(1);
});

it('reports a token delete failure that is not a permission denial', async () => {
  const logger = makeLogger();
  const deleteMock = jest.fn().mockRejectedValue(new Error('table unavailable'));
  const state = makeState(deleteMock);
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state, logger);

  const err = await initOnce(core);

  expect(err).toEqual(new Error('table unavailable'));
  expect(state.batchWrite).not.toHaveBeenCalled();
  expect(state.put).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
});
