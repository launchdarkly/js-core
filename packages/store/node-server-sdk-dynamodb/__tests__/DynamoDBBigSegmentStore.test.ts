import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { interfaces } from '@launchdarkly/node-server-sdk';

import DynamoDBBigSegmentStore, {
  ATTR_EXCLUDED,
  ATTR_INCLUDED,
  ATTR_SYNC_ON,
  KEY_METADATA,
  KEY_USER_DATA,
} from '../src/DynamoDBBigSegmentStore';
import LDDynamoDBOptions from '../src/LDDynamoDBOptions';
import { numberValue, stringValue } from '../src/Value';
import clearPrefix from './clearPrefix';
import setupTable from './setupTable';

const FAKE_HASH = 'userhash';

const DEFAULT_TABLE_NAME = 'test-table-big-segments';

const DEFAULT_CLIENT_OPTIONS: LDDynamoDBOptions = {
  clientOptions: {
    endpoint: 'http://localhost:8000',
    region: 'us-west-2',
    credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
  },
};

async function setMetadata(
  prefix: string | undefined,
  metadata: interfaces.BigSegmentStoreMetadata,
): Promise<void> {
  const client = new DynamoDBClient(DEFAULT_CLIENT_OPTIONS.clientOptions!);
  const key = prefix ? `${prefix}:${KEY_METADATA}` : KEY_METADATA;
  await client.send(
    new PutItemCommand({
      TableName: DEFAULT_TABLE_NAME,
      Item: {
        namespace: stringValue(key),
        key: stringValue(key),
        [ATTR_SYNC_ON]: numberValue(metadata.lastUpToDate!),
      },
    }),
  );
  client.destroy();
}

async function setSegments(
  prefix: string | undefined,
  userHashKey: string,
  included: string[],
  excluded: string[],
): Promise<void> {
  const client = new DynamoDBClient(DEFAULT_CLIENT_OPTIONS.clientOptions!);
  const key = prefix ? `${prefix}:${KEY_USER_DATA}` : KEY_USER_DATA;

  async function addToSet(attrName: string, values: string[]) {
    await client.send(
      new UpdateItemCommand({
        TableName: DEFAULT_TABLE_NAME,
        Key: {
          namespace: stringValue(key),
          key: stringValue(userHashKey),
        },
        UpdateExpression: `ADD ${attrName} :value`,
        ExpressionAttributeValues: {
          ':value': { SS: values },
        },
      }),
    );
  }

  if (included && included.length) {
    await addToSet(ATTR_INCLUDED, included);
  }

  if (excluded && excluded.length) {
    await addToSet(ATTR_EXCLUDED, excluded);
  }

  client.destroy();
}

describe.each([undefined, 'app1'])('given a dynamodb big segment store', (prefixParam) => {
  let store: DynamoDBBigSegmentStore;

  beforeEach(async () => {
    await setupTable(DEFAULT_TABLE_NAME, DEFAULT_CLIENT_OPTIONS.clientOptions!);
    await clearPrefix(DEFAULT_TABLE_NAME, prefixParam);
    // Use param directly to test undefined.
    store = new DynamoDBBigSegmentStore(DEFAULT_TABLE_NAME, {
      ...DEFAULT_CLIENT_OPTIONS,
      prefix: prefixParam,
    });
  });

  afterEach(async () => {
    store.close();
  });

  it('can get populated meta data', async () => {
    const expected = { lastUpToDate: 1234567890 };
    await setMetadata(prefixParam, expected);
    const meta = await store.getMetadata();
    expect(meta).toEqual(expected);
  });

  it('can get metadata when not populated', async () => {
    const meta = await store.getMetadata();
    expect(meta?.lastUpToDate).toBeUndefined();
  });

  it('can get user membership for a user which has no membership', async () => {
    const membership = await store.getUserMembership(FAKE_HASH);
    expect(membership).toBeUndefined();
  });

  it('can get membership for a user that is only included', async () => {
    await setSegments(prefixParam, FAKE_HASH, ['key1', 'key2'], []);

    const membership = await store.getUserMembership(FAKE_HASH);
    expect(membership).toEqual({ key1: true, key2: true });
  });

  it('can get membership for a user that is only excluded', async () => {
    await setSegments(prefixParam, FAKE_HASH, [], ['key1', 'key2']);

    const membership = await store.getUserMembership(FAKE_HASH);
    expect(membership).toEqual({ key1: false, key2: false });
  });

  it('can get membership for a user that is included and excluded', async () => {
    await setSegments(prefixParam, FAKE_HASH, ['key1', 'key2'], ['key2', 'key3']);

    const membership = await store.getUserMembership(FAKE_HASH);
    expect(membership).toEqual({ key1: true, key2: true, key3: false }); // include of key2 overrides exclude
  });
});
