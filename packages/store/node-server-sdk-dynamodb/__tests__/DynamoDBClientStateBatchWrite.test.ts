import { DynamoDBClient, WriteRequest } from '@aws-sdk/client-dynamodb';

import DynamoDBClientState from '../src/DynamoDBClientState';

const TABLE_NAME = 'test-table';

function makeWriteRequest(key: string): WriteRequest {
  return {
    PutRequest: {
      Item: {
        namespace: { S: 'features' },
        key: { S: key },
      },
    },
  };
}

function makeState(send: jest.Mock): DynamoDBClientState {
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  return new DynamoDBClientState({ dynamoDBClient: client });
}

afterEach(() => {
  jest.useRealTimers();
});

it('does not retry when the response contains no unprocessed items', async () => {
  const send = jest.fn().mockResolvedValue({});
  const state = makeState(send);

  await state.batchWrite(TABLE_NAME, [makeWriteRequest('flagA'), makeWriteRequest('flagB')]);

  expect(send).toHaveBeenCalledTimes(1);
});

it('treats an empty unprocessed map as success', async () => {
  const send = jest.fn().mockResolvedValue({ UnprocessedItems: {} });
  const state = makeState(send);

  await state.batchWrite(TABLE_NAME, [makeWriteRequest('flagA')]);

  expect(send).toHaveBeenCalledTimes(1);
});

it('retries only the unprocessed items until they succeed', async () => {
  jest.useFakeTimers();
  const requestA = makeWriteRequest('flagA');
  const requestB = makeWriteRequest('flagB');
  const send = jest
    .fn()
    .mockResolvedValueOnce({ UnprocessedItems: { [TABLE_NAME]: [requestB] } })
    .mockResolvedValue({});
  const state = makeState(send);

  const pendingWrite = state.batchWrite(TABLE_NAME, [requestA, requestB]);
  await jest.runAllTimersAsync();
  await pendingWrite;

  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].input.RequestItems[TABLE_NAME]).toEqual([requestB]);
});

it('throws when items remain unprocessed after the retries are exhausted', async () => {
  jest.useFakeTimers();
  const requestA = makeWriteRequest('flagA');
  const send = jest.fn().mockResolvedValue({ UnprocessedItems: { [TABLE_NAME]: [requestA] } });
  const state = makeState(send);

  const pendingWrite = state.batchWrite(TABLE_NAME, [requestA]);
  // The assertion is awaited after the fake timers run.
  // eslint-disable-next-line jest/valid-expect
  const assertion = expect(pendingWrite).rejects.toThrow(
    'DynamoDB batch write returned 1 unprocessed item(s) after 3 retries',
  );
  await jest.runAllTimersAsync();
  await assertion;

  expect(send).toHaveBeenCalledTimes(4);
});

it('waits with exponential backoff before each retry', async () => {
  jest.useFakeTimers();
  const requestA = makeWriteRequest('flagA');
  const send = jest.fn().mockResolvedValue({ UnprocessedItems: { [TABLE_NAME]: [requestA] } });
  const state = makeState(send);

  const pendingWrite = state.batchWrite(TABLE_NAME, [requestA]);
  // The assertion is awaited after the fake timers run.
  // eslint-disable-next-line jest/valid-expect
  const assertion = expect(pendingWrite).rejects.toThrow(
    'DynamoDB batch write returned 1 unprocessed item(s) after 3 retries',
  );

  // The first attempt does not wait.
  await jest.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledTimes(1);

  // The first retry waits 100 milliseconds.
  await jest.advanceTimersByTimeAsync(99);
  expect(send).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(send).toHaveBeenCalledTimes(2);

  // The second retry waits 200 milliseconds.
  await jest.advanceTimersByTimeAsync(199);
  expect(send).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(1);
  expect(send).toHaveBeenCalledTimes(3);

  // The third retry waits 400 milliseconds.
  await jest.advanceTimersByTimeAsync(399);
  expect(send).toHaveBeenCalledTimes(3);
  await jest.advanceTimersByTimeAsync(1);
  expect(send).toHaveBeenCalledTimes(4);

  await assertion;
});
