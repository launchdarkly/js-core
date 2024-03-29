import { LDOptions } from '@launchdarkly/node-server-sdk';
import DynamoDBBigSegmentStoreFactory from '../src/DynamoDBBigSegmentStoreFactory';

it('can construct options with a big segment store', () => {
  // This is just a typescript test to ensure the typings match.
  const _: LDOptions = {
    bigSegments: {
      store: DynamoDBBigSegmentStoreFactory("my-table")
    }
  }
});
