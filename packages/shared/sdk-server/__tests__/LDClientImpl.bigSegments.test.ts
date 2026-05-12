import { Crypto, Hasher, Hmac } from '@launchdarkly/js-sdk-common';

import { LDBigSegmentsOptions } from '../src';
import { BigSegmentStore } from '../src/api/interfaces';
import makeBigSegmentRef from '../src/evaluation/makeBigSegmentRef';
import TestData from '../src/integrations/test_data/TestData';
import LDClientImpl from '../src/LDClientImpl';
import { createBasicPlatform } from './createBasicPlatform';
import { makeSegmentMatchClause } from './evaluation/flags';
import makeCallbacks from './makeCallbacks';

const user = { key: 'userkey' };
const bigSegment = {
  key: 'segmentkey',
  version: 1,
  unbounded: true,
  generation: 2,
};
const flag = {
  key: 'flagkey',
  on: true,
  variations: [false, true],
  fallthrough: { variation: 0 },
  rules: [{ variation: 1, clauses: [makeSegmentMatchClause(bigSegment)] }],
};

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

describe('given test data with big segments', () => {
  let client: LDClientImpl;
  let td: TestData;

  beforeEach(async () => {
    td = new TestData();
    td.usePreconfiguredFlag(flag);
    td.usePreconfiguredSegment(bigSegment);
  });

  describe('given a big segment store without the user', () => {
    beforeEach(async () => {
      const bigSegmentsConfig: LDBigSegmentsOptions = {
        store(): BigSegmentStore {
          return {
            getMetadata: async () => ({ lastUpToDate: Date.now() }),
            getUserMembership: async () => undefined,
            close: () => {},
          };
        },
      };

      client = new LDClientImpl(
        'sdk-key-big-segments-test-data',
        { ...createBasicPlatform(), crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          bigSegments: bigSegmentsConfig,
        },
        makeCallbacks(true),
      );

      await client.waitForInitialization({ timeout: 10 });
    });

    afterEach(() => {
      client.close();
    });

    it('user not found in big segment store', async () => {
      const result = await client.variationDetail(flag.key, user, false);
      expect(result.value).toBe(false);
      expect(result.reason.bigSegmentsStatus).toEqual('HEALTHY');
    });
  });

  describe('given a big segment store with the user', () => {
    beforeEach(async () => {
      const membership = { [makeBigSegmentRef(bigSegment)]: true };
      const bigSegmentsConfig: LDBigSegmentsOptions = {
        store(): BigSegmentStore {
          return {
            getMetadata: async () => ({ lastUpToDate: Date.now() }),
            getUserMembership: async (hash) =>
              hash === `is_hashed:${user.key}` ? membership : undefined,
            close: () => {},
          };
        },
      };

      client = new LDClientImpl(
        'sdk-key-big-segments-with-user',
        { ...createBasicPlatform(), crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          bigSegments: bigSegmentsConfig,
        },
        makeCallbacks(true),
      );

      await client.waitForInitialization({ timeout: 10 });
    });

    afterEach(() => {
      client.close();
    });

    it('user found in big segment store', async () => {
      const result = await client.variationDetail(flag.key, user, false);
      expect(result.value).toBe(true);
      expect(result.reason.bigSegmentsStatus).toEqual('HEALTHY');
    });
  });

  describe('given a big segment store which experiences an error', () => {
    beforeEach(async () => {
      const bigSegmentsConfig: LDBigSegmentsOptions = {
        store(): BigSegmentStore {
          return {
            getMetadata: async () => ({ lastUpToDate: Date.now() }),
            getUserMembership: async () => {
              throw new Error('sorry');
            },
            close: () => {},
          };
        },
      };

      client = new LDClientImpl(
        'sdk-key-big-segments-store-error',
        { ...createBasicPlatform(), crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          bigSegments: bigSegmentsConfig,
        },
        makeCallbacks(true),
      );

      await client.waitForInitialization({ timeout: 10 });
    });

    afterEach(() => {
      client.close();
    });

    it('produces a store error', async () => {
      const result = await client.variationDetail(flag.key, user, false);
      expect(result.value).toBe(false);
      expect(result.reason.bigSegmentsStatus).toEqual('STORE_ERROR');
    });
  });

  describe('given a client without big segment support.', () => {
    beforeEach(async () => {
      client = new LDClientImpl(
        'sdk-key-big-segments-no-store',
        { ...createBasicPlatform(), crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
        },
        makeCallbacks(true),
      );

      await client.waitForInitialization({ timeout: 10 });
    });

    afterEach(() => {
      client.close();
    });

    it('produces a not configured error', async () => {
      const result = await client.variationDetail(flag.key, user, false);
      expect(result.value).toBe(false);
      expect(result.reason.bigSegmentsStatus).toEqual('NOT_CONFIGURED');
    });
  });
});
