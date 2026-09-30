import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import DynamoDBClientState from '../src/DynamoDBClientState';

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actual,
    DynamoDBClient: jest.fn((config) => new actual.DynamoDBClient(config)),
  };
});

const defaultRequestHandler = {
  connectionTimeout: 10000,
  requestTimeout: 30000,
  throwOnRequestTimeout: true,
};

beforeEach(() => {
  (DynamoDBClient as unknown as jest.Mock).mockClear();
});

it('applies the timeout defaults to the client it constructs by default', () => {
  const state = new DynamoDBClientState();

  expect(DynamoDBClient).toHaveBeenCalledWith({
    requestHandler: defaultRequestHandler,
  });
  state.close();
});

it('applies the timeout defaults when client options have no request handler', () => {
  // One hung request without a timeout would block the whole store queue, so
  // the common credentials/region configurations must keep the defaults.
  const clientOptions = { region: 'us-east-1' };
  const state = new DynamoDBClientState({ clientOptions });

  expect(DynamoDBClient).toHaveBeenCalledWith({
    requestHandler: defaultRequestHandler,
    region: 'us-east-1',
  });
  state.close();
});

it('applies the timeout defaults when the request handler is explicitly undefined', () => {
  // A config builder that spreads optional fields can produce an explicit
  // undefined, and a plain spread would let it erase the defaults.
  const state = new DynamoDBClientState({
    clientOptions: { region: 'us-east-1', requestHandler: undefined },
  });

  expect(DynamoDBClient).toHaveBeenCalledWith({
    requestHandler: defaultRequestHandler,
    region: 'us-east-1',
  });
  state.close();
});

it('keeps a user-supplied request handler', () => {
  const requestHandler = { requestTimeout: 5000 };
  const state = new DynamoDBClientState({ clientOptions: { requestHandler } });

  expect(DynamoDBClient).toHaveBeenCalledWith({ requestHandler });
  state.close();
});

it('does not construct a client when one is supplied', () => {
  // @ts-ignore Partial client mock for testing.
  const client = { send: jest.fn(), destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  expect(DynamoDBClient).not.toHaveBeenCalled();
  state.close();
});

it('passes an abort signal with every send', async () => {
  const send = jest
    .fn()
    .mockResolvedValueOnce({ Item: undefined }) // get
    .mockResolvedValueOnce({}) // put
    .mockResolvedValueOnce({}) // delete
    .mockResolvedValueOnce({ UnprocessedItems: {} }) // batchWrite
    .mockResolvedValueOnce({ Items: [] }); // query page
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  const key = { namespace: { S: 'ns' }, key: { S: 'key' } };
  await state.get('table', key);
  await state.put({ TableName: 'table', Item: key });
  await state.delete('table', key);
  await state.batchWrite('table', [{ PutRequest: { Item: key } }]);
  await state.query({ TableName: 'table' });

  // The elapsed-time backstop must apply to every operation and to
  // user-supplied clients, whose handler configuration is unknown.
  expect(send).toHaveBeenCalledTimes(5);
  send.mock.calls.forEach((call) => {
    expect(call[1]?.abortSignal).toBeInstanceOf(AbortSignal);
  });
  state.close();
});

it('clears the deadline timer when the call settles', async () => {
  // A timer that outlives the call would retain the request for the full
  // deadline on request handlers that never remove their abort listener.
  const clearSpy = jest.spyOn(global, 'clearTimeout');
  const send = jest.fn().mockResolvedValue({ Item: undefined });
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  clearSpy.mockClear();
  await state.get('table', { namespace: { S: 'ns' }, key: { S: 'key' } });

  expect(clearSpy).toHaveBeenCalled();
  clearSpy.mockRestore();
  state.close();
});

it('sends without a signal when the runtime has no AbortController', async () => {
  const send = jest.fn().mockResolvedValue({ Item: undefined });
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  const saved = global.AbortController;
  // @ts-ignore Simulate a runtime without abort support.
  delete global.AbortController;
  try {
    await state.get('table', { namespace: { S: 'ns' }, key: { S: 'key' } });
  } finally {
    global.AbortController = saved;
  }

  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][1]?.abortSignal).toBeUndefined();
  state.close();
});

it('collects every page of a query', async () => {
  const item1 = { key: { S: 'a' } };
  const item2 = { key: { S: 'b' } };
  const send = jest
    .fn()
    .mockResolvedValueOnce({ Items: [item1], LastEvaluatedKey: item1 })
    .mockResolvedValueOnce({ Items: [item2] });
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  const records = await state.query({ TableName: 'table' });

  expect(records).toEqual([item1, item2]);
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0][0].input.ExclusiveStartKey).toBeUndefined();
  expect(send.mock.calls[1][0].input.ExclusiveStartKey).toEqual(item1);
  state.close();
});

it('starts a query from the ExclusiveStartKey the caller supplies', async () => {
  const startKey = { key: { S: 'start' } };
  const item = { key: { S: 'a' } };
  const send = jest.fn().mockResolvedValueOnce({ Items: [item] });
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  const records = await state.query({ TableName: 'table', ExclusiveStartKey: startKey });

  expect(records).toEqual([item]);
  // A rewound first page would read the table from the top again.
  expect(send.mock.calls[0][0].input.ExclusiveStartKey).toEqual(startKey);
  state.close();
});
