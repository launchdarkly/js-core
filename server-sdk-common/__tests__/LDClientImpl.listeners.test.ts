import { AsyncQueue } from 'launchdarkly-js-test-helpers';
import { LDClientImpl } from '../src';
import TestData from '../src/integrations/test_data/TestData';
import basicPlatform from './evaluation/mocks/platform';
import TestLogger from './Logger';
import makeCallbacks from './makeCallbacks';

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let td: TestData;
  let queue: AsyncQueue<string>;

  beforeEach(() => {
    queue = new AsyncQueue();
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        logger: new TestLogger(),
      },
      { ...makeCallbacks(true), onUpdate: (key: string) => queue.add(key) },
    );
  });

  afterEach(() => {
    client.close();
  });

  it('sends an event when a flag is added', async () => {
    td.update(td.flag('new-flag'));
    expect(await queue.take()).toEqual('new-flag');
  });

  it('sends an event when a flag is updated', async () => {
    td.update(td.flag('flag1').on(true));
    td.update(td.flag('flag2').on(true));

    expect(await queue.take()).toEqual('flag1');
    expect(await queue.take()).toEqual('flag2');

    td.update(td.flag('flag1').on(false));
    td.update(td.flag('flag2').on(false));

    expect(await queue.take()).toEqual('flag1');
    expect(await queue.take()).toEqual('flag2');
  });
});
