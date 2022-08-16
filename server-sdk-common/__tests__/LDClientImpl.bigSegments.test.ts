/* eslint-disable @typescript-eslint/no-unused-vars */
import { LDBigSegmentsOptions, LDClientImpl } from '../src';
import { BigSegmentStore } from '../src/api/interfaces';
import { LDClientContext } from '../src/api/options/LDClientContext';
import makeBigSegmentRef from '../src/evaluation/makeBigSegmentRef';
import TestData from '../src/integrations/test_data/TestData';
import { Hasher, Crypto, Hmac } from '../src/platform';
import { makeSegmentMatchClause } from './evaluation/flags';
import basicPlatform from './evaluation/mocks/platform';

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
  rules: [
    { variation: 1, clauses: [makeSegmentMatchClause(bigSegment)] },
  ],
};

class TestHasher implements Hasher {
  private value: string = 'is_hashed:';

  update(toAdd: string): Hasher {
    this.value += toAdd;
    return this;
  }

  digest() {
    return this.value;
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
        store(clientContext: LDClientContext): BigSegmentStore {
          return {
            getMetadata: async () => ({ lastUpToDate: new Date().getTime() }),
            getUserMembership: async () => undefined,
            close: () => { },
          };
        },
      };

      client = new LDClientImpl(
        'sdk-key',
        { ...basicPlatform, crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          bigSegments: bigSegmentsConfig,
        },
        (_err) => { },
        (_err) => { },
        () => { },
        (key) => { },
        // Always listen to events.
        () => true,
      );

      await client.waitForInitialization();
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
        store(clientContext: LDClientContext): BigSegmentStore {
          return {
            getMetadata: async () => ({ lastUpToDate: new Date().getTime() }),
            getUserMembership: async (hash) => (hash === `is_hashed:${user.key}` ? membership : undefined),
            close: () => { },
          };
        },
      };

      client = new LDClientImpl(
        'sdk-key',
        { ...basicPlatform, crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          bigSegments: bigSegmentsConfig,
        },
        (_err) => { },
        (_err) => { },
        () => { },
        (key) => { },
        // Always listen to events.
        () => true,
      );

      await client.waitForInitialization();
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
        store(clientContext: LDClientContext): BigSegmentStore {
          return {
            getMetadata: async () => ({ lastUpToDate: new Date().getTime() }),
            getUserMembership: async (hash) => { throw new Error('sorry'); },
            close: () => { },
          };
        },
      };

      client = new LDClientImpl(
        'sdk-key',
        { ...basicPlatform, crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          bigSegments: bigSegmentsConfig,
        },
        (_err) => { },
        (_err) => { },
        () => { },
        (key) => { },
        // Always listen to events.
        () => true,
      );

      await client.waitForInitialization();
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
        'sdk-key',
        { ...basicPlatform, crypto },
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
        },
        (_err) => { },
        (_err) => { },
        () => { },
        (key) => { },
        // Always listen to events.
        () => true,
      );

      await client.waitForInitialization();
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
