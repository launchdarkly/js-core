import type { Crypto, Hasher, Hmac } from '@launchdarkly/js-sdk-common';

import {
  BigSegmentStore,
  BigSegmentStoreMembership,
  BigSegmentStoreStatus,
} from '../src/api/interfaces';
import BigSegmentsManager from '../src/BigSegmentsManager';
import TestLogger from './Logger';

async function alwaysUpToDate() {
  return { lastUpToDate: Date.now() };
}

async function alwaysStale() {
  return { lastUpToDate: Date.now() - 1000000 };
}

const userKey = 'userkey';
// We are using a fake hasher, so the value will not actually be hashed,
// but if given the correct key, the result should be  this.
const userHash = 'is_hashed:userkey';

class TestHasher implements Hasher {
  private _value: string = 'is_hashed:';

  update(toAdd: string): Hasher {
    this._value += toAdd;
    return this;
  }

  digest() {
    return this._value;
  }
}

const crypto: Crypto = {
  createHash(algorithm: string): Hasher {
    expect(algorithm).toEqual('sha256');
    return new TestHasher();
  },
  createHmac(algorithm: string, key: string): Hmac {
    // Not used for this test.
    throw new Error(`Function not implemented.${algorithm}${key}`);
  },
  randomUUID(): string {
    // Not used for this test.
    throw new Error(`Function not implemented.`);
  },
};

describe.each(['STALE', 'HEALTHY'])('given a %s store', (status) => {
  const expectedMembership = { key1: true, key2: true };
  let store: BigSegmentStore;
  let manager: BigSegmentsManager;
  beforeEach(() => {
    store = {
      getMetadata: status === 'HEALTHY' ? alwaysUpToDate : alwaysStale,
      getUserMembership: jest.fn(async () => expectedMembership),
      close: () => {},
    };
    manager = new BigSegmentsManager(store, {}, new TestLogger(), crypto);
  });

  afterEach(() => {
    manager.close();
  });

  it(`gets uncached membership and ${status} status`, async () => {
    const res = await manager.getUserMembership(userKey);
    expect(res).toEqual([expectedMembership, status]);
  });

  it(`gets cached membership and ${status} status`, async () => {
    const res1 = await manager.getUserMembership(userKey);
    expect(res1).toEqual([expectedMembership, status]);

    const res2 = await manager.getUserMembership(userKey);
    expect(res2).toEqual(res1);
    // Second time should use the cache, so there should only be 1 call.
    expect(store.getUserMembership).toBeCalledTimes(1);
  });
});

describe('given a store without meta data', () => {
  const expectedMembership = { key1: true, key2: true };
  let store: BigSegmentStore;
  let manager: BigSegmentsManager;
  beforeEach(() => {
    store = {
      getMetadata: async () => undefined,
      getUserMembership: jest.fn(async (hash) => {
        expect(hash).toEqual(userHash);
        return expectedMembership;
      }),
      close: () => {},
    };
    manager = new BigSegmentsManager(store, {}, new TestLogger(), crypto);
  });

  afterEach(() => {
    manager.close();
  });

  it('has a stale status', async () => {
    const res = await manager.getUserMembership(userKey);
    expect(res).toEqual([expectedMembership, 'STALE']);
  });
});

describe('given a store with a user cache size of 2', () => {
  const userKey1 = 'userkey1';
  const userKey2 = 'userkey2';
  const userKey3 = 'userkey3';
  const userHash1 = 'is_hashed:userkey1';
  const userHash2 = 'is_hashed:userkey2';
  const userHash3 = 'is_hashed:userkey3';

  const memberships: Record<string, BigSegmentStoreMembership> = {};
  memberships[userHash1] = { seg1: true };
  memberships[userHash2] = { seg2: true };
  memberships[userHash3] = { seg3: true };

  let store: BigSegmentStore;
  let manager: BigSegmentsManager;
  beforeEach(() => {
    store = {
      getMetadata: alwaysUpToDate,
      getUserMembership: jest.fn(async (hash) => memberships[hash]),
      close: () => {},
    };
    manager = new BigSegmentsManager(
      store,
      {
        userCacheSize: 2,
      },
      new TestLogger(),
      crypto,
    );
  });

  afterEach(() => {
    manager.close();
  });

  it('evicts the least recent user from the cache', async () => {
    const result1 = await manager.getUserMembership(userKey1);
    expect(store.getUserMembership).toHaveBeenCalledWith(userHash1);

    const result2 = await manager.getUserMembership(userKey2);
    expect(store.getUserMembership).toHaveBeenCalledWith(userHash2);

    const result3 = await manager.getUserMembership(userKey3);
    expect(store.getUserMembership).toHaveBeenCalledWith(userHash2);

    expect(result1).toEqual([memberships[userHash1], 'HEALTHY']);
    expect(result2).toEqual([memberships[userHash2], 'HEALTHY']);
    expect(result3).toEqual([memberships[userHash3], 'HEALTHY']);

    expect(store.getUserMembership).toHaveBeenCalledTimes(3);

    // User 2 and 3 should still be cached, so the query count should not increase.
    const result2a = await manager.getUserMembership(userKey2);
    const result3a = await manager.getUserMembership(userKey3);
    expect(result2a).toEqual(result2);
    expect(result3a).toEqual(result3);

    expect(store.getUserMembership).toHaveBeenCalledTimes(3);

    // User 1 should have been evicted, so asking for it again should
    // result in another query.
    const result1a = await manager.getUserMembership(userKey1);
    expect(result1a).toEqual(result1);

    expect(store.getUserMembership).toHaveBeenCalledTimes(4);

    // TS doesn't understand it is a mock.
    // @ts-ignore
    expect(store.getUserMembership.mock.calls).toEqual([
      [userHash1],
      [userHash2],
      [userHash3],
      [userHash1],
    ]);
  });
});

describe('given a store with a short poll interval.', () => {
  const expectedMembership = { key1: true, key2: true };
  let store: BigSegmentStore;
  let manager: BigSegmentsManager;

  let statuses: BigSegmentStoreStatus[];
  let resolvers: (() => void)[];
  let promises: Promise<void>[];

  beforeEach(() => {
    statuses = [];
    resolvers = [];
    promises = [
      new Promise((a) => {
        resolvers.push(a);
      }),
      new Promise((a) => {
        resolvers.push(a);
      }),
      new Promise((a) => {
        resolvers.push(a);
      }),
    ];

    store = {
      getMetadata: alwaysUpToDate,
      getUserMembership: jest.fn(async () => expectedMembership),
      close: () => {},
    };
    manager = new BigSegmentsManager(
      store,
      {
        statusPollInterval: 0.01,
      },
      new TestLogger(),
      crypto,
    );

    let count = 0;
    manager.statusProvider.setListener((status) => {
      statuses.push(status);
      if (count < resolvers.length) {
        resolvers[count]();
      }
      count += 1;
    });
  });

  afterEach(() => {
    manager.close();
  });

  it('detects when the store is not available', async () => {
    const frozenTime = Date.now();
    Date.now = jest.fn(() => frozenTime);

    const status1 = await manager.statusProvider.requireStatus();
    expect(status1.available).toBe(true);

    store.getMetadata = async () => {
      throw new Error('sorry');
    };

    await promises[1];
    expect(statuses[1].available).toBe(false);
    expect(manager.statusProvider.getStatus()).toEqual(statuses[1]);
    store.getMetadata = alwaysUpToDate;

    await promises[2];
    expect(statuses[2].available).toBe(true);
    expect(manager.statusProvider.getStatus()).toEqual(statuses[2]);
  });

  it('detects stale status', async () => {
    const status1 = await manager.statusProvider.requireStatus();
    expect(status1.stale).toBe(false);

    store.getMetadata = alwaysStale;
    await promises[1];
    expect(statuses[1].stale).toBe(true);
    expect(manager.statusProvider.getStatus()).toEqual(statuses[1]);

    store.getMetadata = alwaysUpToDate;
    await promises[2];
    expect(statuses[2].stale).toBe(false);
    expect(manager.statusProvider.getStatus()).toEqual(statuses[2]);
  });
});
