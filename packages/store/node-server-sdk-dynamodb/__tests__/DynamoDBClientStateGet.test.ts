import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import DynamoDBClientState from '../src/DynamoDBClientState';
import DynamoDBCore from '../src/DynamoDBCore';

const TABLE_NAME = 'test-table';

function makeState(send: jest.Mock): DynamoDBClientState {
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  return new DynamoDBClientState({ dynamoDBClient: client });
}

it('reads eventually consistent by default', async () => {
  const send = jest.fn().mockResolvedValue({ Item: undefined });
  const state = makeState(send);

  await state.get(TABLE_NAME, { namespace: { S: 'features' }, key: { S: 'flagA' } });

  expect(send.mock.calls[0][0].input.ConsistentRead).toBe(false);
});

it('uses a consistent read for the initialized token', async () => {
  const send = jest.fn().mockResolvedValue({ Item: undefined });
  const core = new DynamoDBCore(TABLE_NAME, makeState(send));

  const isInitialized = await new Promise((resolve) => {
    core.initialized(resolve);
  });

  expect(isInitialized).toBe(false);
  expect(send.mock.calls[0][0].input.ConsistentRead).toBe(true);
});
