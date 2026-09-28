import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import DynamoDBClientState from '../src/DynamoDBClientState';

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actual,
    DynamoDBClient: jest.fn((config) => new actual.DynamoDBClient(config)),
  };
});

beforeEach(() => {
  (DynamoDBClient as unknown as jest.Mock).mockClear();
});

it('applies a request timeout to the client it constructs by default', () => {
  const state = new DynamoDBClientState();

  expect(DynamoDBClient).toHaveBeenCalledWith({
    requestHandler: { requestTimeout: 30000, throwOnRequestTimeout: true },
  });
  state.close();
});

it('does not add a request timeout to user-supplied client options', () => {
  const clientOptions = { region: 'us-east-1' };
  const state = new DynamoDBClientState({ clientOptions });

  expect(DynamoDBClient).toHaveBeenCalledWith(clientOptions);
  state.close();
});

it('does not construct a client when one is supplied', () => {
  // @ts-ignore Partial client mock for testing.
  const client = { send: jest.fn(), destroy: jest.fn() } as DynamoDBClient;
  const state = new DynamoDBClientState({ dynamoDBClient: client });

  expect(DynamoDBClient).not.toHaveBeenCalled();
  state.close();
});
