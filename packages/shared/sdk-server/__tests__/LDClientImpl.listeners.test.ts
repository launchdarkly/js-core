import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { AttributeReference, LDClientImpl } from '../src';
import { Op } from '../src/evaluation/data/Clause';
import TestData from '../src/integrations/test_data/TestData';
import { createBasicPlatform } from './createBasicPlatform';
import { makeFlagWithSegmentMatch } from './evaluation/flags';
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
      'sdk-key-listeners',
      createBasicPlatform(),
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

  it('sends an event when a segment used by a flag is updated', async () => {
    const segment = {
      key: 'segment1',
      includedContexts: [{ contextKind: 'org', values: ['org-key'] }],
      version: 1,
    };

    td.usePreconfiguredSegment(segment);
    td.usePreconfiguredFlag(makeFlagWithSegmentMatch(segment));

    td.usePreconfiguredSegment({
      key: 'segment1',
      includedContexts: [{ contextKind: 'org', values: ['org-key', 'second-key'] }],
      version: 2,
    });

    expect(await queue.take()).toEqual('feature');
  });

  it('sends an event for a nested segment update', async () => {
    const segment1 = {
      key: 'segment1',
      includedContexts: [{ contextKind: 'org', values: ['org-key'] }],
      version: 1,
    };
    const segment2 = {
      key: 'segment2',
      rules: [
        {
          id: 'rule-1',
          clauses: [
            {
              attribute: '',
              op: 'segmentMatch' as Op,
              values: [segment1.key],
              attributeReference: new AttributeReference(''),
            },
          ],
          weight: 100000,
        },
      ],
      version: 1,
    };
    td.usePreconfiguredSegment(segment1);
    td.usePreconfiguredSegment(segment2);
    td.usePreconfiguredFlag(makeFlagWithSegmentMatch(segment2));

    td.usePreconfiguredSegment({
      key: 'segment1',
      includedContexts: [{ contextKind: 'org', values: ['org-key', 'second-key'] }],
      version: 2,
    });

    expect(await queue.take()).toEqual('feature');
  });

  it('does not hang on circular segment dependencies', async () => {
    const segment1 = {
      key: 'segment1',
      clauses: [{ attribute: '', op: 'segmentMatch', values: ['segment2'] }],
      version: 1,
    };
    const segment2 = {
      key: 'segment2',
      rules: [
        {
          id: 'rule-1',
          clauses: [
            {
              attribute: '',
              op: 'segmentMatch' as Op,
              values: [segment1.key],
              attributeReference: new AttributeReference(''),
            },
          ],
          weight: 100000,
        },
      ],
      version: 1,
    };

    td.usePreconfiguredSegment(segment1);
    td.usePreconfiguredSegment(segment2);
    td.usePreconfiguredFlag(makeFlagWithSegmentMatch(segment2));

    td.usePreconfiguredSegment({
      key: 'segment1',
      includedContexts: [{ contextKind: 'org', values: ['org-key', 'second-key'] }],
      version: 2,
    });

    expect(await queue.take()).toEqual('feature');
  });
});
