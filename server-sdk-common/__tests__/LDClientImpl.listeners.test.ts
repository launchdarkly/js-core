import { LDClientImpl } from '../src';
import TestData from '../src/integrations/test_data/TestData';
import basicPlatform from './evaluation/mocks/platform';

describe('given a a client using test data', () => {
  let td: TestData;
  let client: LDClientImpl;

  const updates = [];

  beforeEach(() => {
    td = new TestData();
    client = new LDClientImpl('sdk-key', basicPlatform, {
      sendEvents: false,
      updateProcessor: td.getFactory(),
    }, () => { }, () => { }, () => { }, (key) => {
      updates.push(key);
    });
  });

  it('fires an event when a flag is added', () => {
    td.update(td.flag('new-flag'));
  });
});
