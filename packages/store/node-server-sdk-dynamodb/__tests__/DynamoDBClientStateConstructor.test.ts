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
  const send = jest.fn().mockResolvedValue({ Item: undefined });
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  await state.get('table', { namespace: { S: 'ns' }, key: { S: 'key' } });

  // The wall-clock backstop must apply to user-supplied clients too; their
  // handler configuration is unknown and can lack any timeout.
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][1]?.abortSignal).toBeInstanceOf(AbortSignal);
  state.close();
});
