import Redis from 'ioredis';
import RedisBigSegmentStore, { KEY_LAST_SYNCHRONIZED, KEY_USER_INCLUDE, KEY_USER_EXCLUDE } from '../src/RedisBigSegmentStore';
import clearPrefix from './clearPrefix';
import { interfaces } from '@launchdarkly/node-server-sdk';

const FAKE_HASH = 'userhash';

describe.each([undefined, 'app1'])('given a redis big segment store', (prefixParam) => {
  let store: RedisBigSegmentStore;
  const prefix = prefixParam || 'launchdarkly';

  async function setMetadata(prefix: string, metadata: interfaces.BigSegmentStoreMetadata): Promise<void> {
    const client = new Redis();
    await client.set(`${prefix}:${KEY_LAST_SYNCHRONIZED}`, metadata.lastUpToDate ? metadata.lastUpToDate.toString() : '');
    await client.quit();
  }
  
  async function setSegments(prefix: string, userHashKey: string, included: string[], excluded: string[]): Promise<void> {
    const client = new Redis();
    for (const ref of included) {
      await client.sadd(`${prefix}:${KEY_USER_INCLUDE}:${userHashKey}`, ref);
    }
    for (const ref of excluded) {
      await client.sadd(`${prefix}:${KEY_USER_EXCLUDE}:${userHashKey}`, ref);
    }
    await client.quit();
  }

  beforeEach(async () => {
    console.log("Clearing prefix", prefix);
    await clearPrefix(prefix);
    // Use param directly to test undefined.
    store = new RedisBigSegmentStore({prefix: prefixParam});
  });

  afterEach(async () => {
    store.close();
  });

  it('can get populated meta data', async () => {
    const expected = { lastUpToDate: 1234567890 };
    await setMetadata(prefix, expected);
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
    await setSegments(prefix, FAKE_HASH, ['key1', 'key2'], []);

    const membership = await store.getUserMembership(FAKE_HASH);
    expect(membership).toEqual({ key1: true, key2: true });
  });

  it('can get membership for a user that is only excluded', async () => {
    await setSegments(prefix, FAKE_HASH, [], ['key1', 'key2']);

    const membership = await store.getUserMembership(FAKE_HASH);
    expect(membership).toEqual({ key1: false, key2: false });
  });

  it('can get membership for a user that is included and excluded', async () => {
    await setSegments(prefix, FAKE_HASH, ['key1', 'key2'], ['key2', 'key3']);

    const membership = await store.getUserMembership(FAKE_HASH);
    expect(membership).toEqual({ key1: true, key2: true, key3: false }); // include of key2 overrides exclude
  });
});