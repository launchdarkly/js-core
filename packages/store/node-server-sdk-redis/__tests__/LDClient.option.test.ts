import { LDOptions } from '@launchdarkly/node-server-sdk';

import RedisBigSegmentStoreFactory from '../src/RedisBigSegmentStoreFactory';

it('can construct options with a big segment store', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const options: LDOptions = {
    bigSegments: {
      store: RedisBigSegmentStoreFactory(),
    },
  };
});
