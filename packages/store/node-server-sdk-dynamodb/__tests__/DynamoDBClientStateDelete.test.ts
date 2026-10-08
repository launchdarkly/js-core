import { DeleteItemCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';

import DynamoDBClientState from '../src/DynamoDBClientState';

const TABLE_NAME = 'test-table';

const TOKEN_KEY = { namespace: { S: '$inited' }, key: { S: '$inited' } };

function makeState(send: jest.Mock): DynamoDBClientState {
  // @ts-ignore Partial client mock for testing.
  const client = { send, destroy: jest.fn() } as DynamoDBClient;
  return new DynamoDBClientState({ dynamoDBClient: client });
}

it('sends a delete command for the given table and key', async () => {
  const send = jest.fn().mockResolvedValue({});
  const state = makeState(send);

  await state.delete(TABLE_NAME, TOKEN_KEY);

  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteItemCommand);
  expect(send.mock.calls[0][0].input).toEqual({
    TableName: TABLE_NAME,
    Key: TOKEN_KEY,
  });
});

it('propagates an error from a failed delete', async () => {
  const error = new Error('delete failed');
  const send = jest.fn().mockRejectedValue(error);
  const state = makeState(send);

  await expect(state.delete(TABLE_NAME, TOKEN_KEY)).rejects.toThrow('delete failed');
});
