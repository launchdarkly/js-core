import { LDBigSegmentsOptions, LDClientImpl } from '../src';
import { BigSegmentStore } from '../src/api/interfaces';
import { LDClientContext } from '../src/api/options/LDClientContext';
import TestData from '../src/integrations/test_data/TestData';
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
}

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
        store: function (clientContext: LDClientContext): BigSegmentStore {
          return {
            getMetadata: async () => { return { lastUpToDate: new Date().getTime() } },
            getUserMembership: async () => ({}),
            close: () => {},
          };
        }
      };

      client = new LDClientImpl(
        'sdk-key',
        basicPlatform,
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          bigSegments: bigSegmentsConfig
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

    it('user not found in big segment store', async () => {
      const result = await client.variationDetail(flag.key, user, false);
      expect(result.value).toBe(false);
      expect(result.reason.bigSegmentsStatus).toEqual('HEALTHY');
    });
  });
});