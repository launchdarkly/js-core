import {
  integrations,
  interfaces,
  LDBigSegmentsOptions,
  LDLogger,
} from '@launchdarkly/js-server-sdk-common';

import { basicLogger } from '../src';
import { LDClient } from '../src/api/LDClient';
import LDClientNode from '../src/LDClientNode';

describe('given test data with big segments', () => {
  // To use the public interfaces to create a client which doesn't use the
  // network. (Versus being offline, or a null update processor.)
  let td: integrations.TestData;
  let logger: LDLogger;

  beforeEach(() => {
    td = new integrations.TestData();
    logger = basicLogger({
      destination: () => {},
    });
  });

  describe('given a healthy big segment store', () => {
    let client: LDClient;
    const bigSegmentsConfig: LDBigSegmentsOptions = {
      statusPollInterval: 0.1,
      store(): interfaces.BigSegmentStore {
        return {
          getMetadata: async () => ({ lastUpToDate: Date.now() }),
          getUserMembership: async () => undefined,
          close: () => {},
        };
      },
    };

    beforeEach(() => {
      client = new LDClientNode('sdk-key', {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        bigSegments: bigSegmentsConfig,
      });
    });

    it('can get status', () => {
      const status = client.bigSegmentStoreStatusProvider.getStatus();
      expect(status).toBeUndefined();
    });

    it('can require status', async () => {
      const status = await client.bigSegmentStoreStatusProvider.requireStatus();
      expect(status.available).toEqual(true);
      expect(status.stale).toEqual(false);
    });

    it('Can listen to the event emitter for the status', (done) => {
      client.bigSegmentStoreStatusProvider.on(
        'change',
        (status: interfaces.BigSegmentStoreStatus) => {
          expect(status.stale).toEqual(false);
          expect(status.available).toEqual(true);

          const status2 = client.bigSegmentStoreStatusProvider.getStatus();
          expect(status2!.stale).toEqual(false);
          expect(status2!.available).toEqual(true);
          done();
        },
      );
    });

    afterEach(() => {
      client.close();
    });
  });

  describe('given a stale store', () => {
    let client: LDClient;
    const bigSegmentsConfig: LDBigSegmentsOptions = {
      store(): interfaces.BigSegmentStore {
        return {
          getMetadata: async () => ({ lastUpToDate: 1000 }),
          getUserMembership: async () => undefined,
          close: () => {},
        };
      },
    };

    beforeEach(async () => {
      client = new LDClientNode('sdk-key', {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        bigSegments: bigSegmentsConfig,
      });

      await client.waitForInitialization({ timeout: 10 });
    });

    it('can require status', async () => {
      const status = await client.bigSegmentStoreStatusProvider.requireStatus();
      expect(status.available).toEqual(true);
      expect(status.stale).toEqual(true);
    });

    afterEach(() => {
      client.close();
    });
  });

  describe('given a store that can produce an error', () => {
    let client: LDClient;
    let error: boolean;
    const bigSegmentsConfig: LDBigSegmentsOptions = {
      statusPollInterval: 0.1,
      store(): interfaces.BigSegmentStore {
        return {
          getMetadata: async () => {
            if (error) {
              throw new Error('sorry');
            }
            return { lastUpToDate: Date.now() };
          },
          getUserMembership: async () => undefined,
          close: () => {},
        };
      },
    };

    beforeEach(async () => {
      error = false;
      client = new LDClientNode('sdk-key', {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        bigSegments: bigSegmentsConfig,
        logger,
      });

      await client.waitForInitialization({ timeout: 10 });
    });

    it('Can observe the status change', (done) => {
      let message = 0;
      client.bigSegmentStoreStatusProvider.on(
        'change',
        (status: interfaces.BigSegmentStoreStatus) => {
          if (message === 0) {
            expect(status.stale).toEqual(false);
            expect(status.available).toEqual(true);
            error = true;
            message += 1;
          } else {
            expect(status.stale).toEqual(false);
            expect(status.available).toEqual(false);
            done();
          }
        },
      );
    });

    afterEach(() => {
      client.close();
    });
  });
});
