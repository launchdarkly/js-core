import {
  DynamoDBClient,
  ProvisionedThroughputExceededException,
  WriteRequest,
} from '@aws-sdk/client-dynamodb';

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
  jest.restoreAllMocks();
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
    'DynamoDB batch write returned 1 unprocessed item(s) after 10 retries',
  );
  await jest.runAllTimersAsync();
  await assertion;

  expect(send).toHaveBeenCalledTimes(11);
});

it('waits with capped exponential backoff before each retry', async () => {
  jest.useFakeTimers();
  // The upper jitter bound makes every delay its full capped value.
  jest.spyOn(Math, 'random').mockReturnValue(1);
  const requestA = makeWriteRequest('flagA');
  const send = jest.fn().mockResolvedValue({ UnprocessedItems: { [TABLE_NAME]: [requestA] } });
  const state = makeState(send);

  const pendingWrite = state.batchWrite(TABLE_NAME, [requestA]);
  // The assertion is awaited after the fake timers run.
  // eslint-disable-next-line jest/valid-expect
  const assertion = expect(pendingWrite).rejects.toThrow(
    'DynamoDB batch write returned 1 unprocessed item(s) after 10 retries',
  );

  // The first attempt does not wait.
  await jest.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledTimes(1);

  // Each retry delay doubles from 100 milliseconds and caps at 5000 milliseconds.
  const expectedDelays = [100, 200, 400, 800, 1600, 3200, 5000, 5000, 5000, 5000];
  for (let i = 0; i < expectedDelays.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await jest.advanceTimersByTimeAsync(expectedDelays[i] - 1);
    expect(send).toHaveBeenCalledTimes(i + 1);
    // eslint-disable-next-line no-await-in-loop
    await jest.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(i + 2);
  }

  await assertion;
});

it('shortens a retry delay by up to half with jitter', async () => {
  jest.useFakeTimers();
  // The lower jitter bound makes every delay half its capped value.
  jest.spyOn(Math, 'random').mockReturnValue(0);
  const requestA = makeWriteRequest('flagA');
  const send = jest
    .fn()
    .mockResolvedValueOnce({ UnprocessedItems: { [TABLE_NAME]: [requestA] } })
    .mockResolvedValue({});
  const state = makeState(send);

  const pendingWrite = state.batchWrite(TABLE_NAME, [requestA]);
  await jest.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledTimes(1);

  // The first retry waits 50 milliseconds, half of the 100 millisecond delay.
  await jest.advanceTimersByTimeAsync(49);
  expect(send).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(send).toHaveBeenCalledTimes(2);

  await pendingWrite;
});

it('retries the whole batch after a provisioned throughput rejection', async () => {
  jest.useFakeTimers();
  const requestA = makeWriteRequest('flagA');
  const send = jest
    .fn()
    .mockRejectedValueOnce(
      new ProvisionedThroughputExceededException({ message: 'over capacity', $metadata: {} }),
    )
    .mockResolvedValue({});
  const state = makeState(send);

  const pendingWrite = state.batchWrite(TABLE_NAME, [requestA]);
  await jest.runAllTimersAsync();
  await pendingWrite;

  // The rejection carries no unprocessed list, so the retry resends every item.
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].input.RequestItems[TABLE_NAME]).toEqual([requestA]);
});

it('reports the throughput rejection when the table stays throttled after the retries', async () => {
  jest.useFakeTimers();
  const requestA = makeWriteRequest('flagA');
  const send = jest
    .fn()
    .mockRejectedValue(
      new ProvisionedThroughputExceededException({ message: 'over capacity', $metadata: {} }),
    );
  const state = makeState(send);

  const pendingWrite = state.batchWrite(TABLE_NAME, [requestA]);
  // The assertion is awaited after the fake timers run.
  // eslint-disable-next-line jest/valid-expect
  const assertion = expect(pendingWrite).rejects.toThrow('over capacity');
  await jest.runAllTimersAsync();
  await assertion;

  expect(send).toHaveBeenCalledTimes(11);
});

it('stops issuing later batches after a failed batch', async () => {
  const requests = Array.from({ length: 26 }, (_, i) => makeWriteRequest(`flag${i}`));
  const send = jest.fn().mockRejectedValueOnce(new Error('batch one failed'));
  const state = makeState(send);

  await expect(state.batchWrite(TABLE_NAME, requests)).rejects.toEqual(
    new Error('batch one failed'),
  );
  // The second batch is never sent, so no request outlives the reported failure.
  expect(send).toHaveBeenCalledTimes(1);
});

it("retries a batch's unprocessed items before writing the next batch", async () => {
  jest.useFakeTimers();
  try {
    const requests = Array.from({ length: 26 }, (_, i) => makeWriteRequest(`flag${i}`));
    const deferred = requests[0];
    const send = jest
      .fn()
      .mockResolvedValueOnce({ UnprocessedItems: { [TABLE_NAME]: [deferred] } })
      .mockResolvedValue({});
    const state = makeState(send);

    const pendingWrite = state.batchWrite(TABLE_NAME, requests);
    await jest.runAllTimersAsync();
    await pendingWrite;

    // Batch one, then its retry, then batch two: a deferred item never lands
    // after an item from a later batch.
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0][0].input.RequestItems[TABLE_NAME]).toHaveLength(25);
    expect(send.mock.calls[1][0].input.RequestItems[TABLE_NAME]).toEqual([deferred]);
    expect(send.mock.calls[2][0].input.RequestItems[TABLE_NAME]).toHaveLength(1);
  } finally {
    jest.useRealTimers();
  }
});
