import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { sleep } from '@launchdarkly/js-sdk-common';

import LDClientImpl from '../src/LDClientImpl';
import { createBasicPlatform } from './createBasicPlatform';
import { makeCallbacks, makeFDv2Client } from './overrides/overridesTestSupport';
import TestOverrideSource from './overrides/TestOverrideSource';

const user = { key: 'user-key' };

// A full FDv2 payload with one LaunchDarkly flag and one segment. The version parameter moves the
// payload state forward so that a later poll is a new data set rather than a repeat.
function payload(version: number, segmentVersion: number): string {
  const events: any[] = [
    {
      event: 'server-intent',
      data: { payloads: [{ intentCode: 'xfer-full', id: 'test-payload', target: version }] },
    },
    {
      event: 'put-object',
      data: {
        kind: 'flag',
        key: 'ld-flag',
        version: 1,
        object: {
          key: 'ld-flag',
          version: 1,
          on: true,
          fallthrough: { variation: 0 },
          variations: [true, false],
        },
      },
    },
    {
      event: 'put-object',
      data: {
        kind: 'segment',
        key: 'segment1',
        version: segmentVersion,
        object: { key: 'segment1', version: segmentVersion, included: [user.key] },
      },
    },
    { event: 'payload-transferred', data: { state: `test-state-${version}`, version } },
  ];
  return JSON.stringify({ events });
}

// An override flag whose only rule matches a LaunchDarkly segment.
function overriddenFlagMatching(segmentKey: string): any {
  return {
    key: 'overridden',
    version: 1,
    on: true,
    fallthrough: { variation: 1 },
    variations: [true, false],
    rules: [
      {
        id: 'rule',
        variation: 0,
        clauses: [{ attribute: '', op: 'segmentMatch', values: [segmentKey], negate: false }],
      },
    ],
  };
}

describe('given an initialized FDv2 client with an override that references a LaunchDarkly segment', () => {
  let body: string;
  let client: LDClientImpl;
  let queue: AsyncQueue<string>;

  beforeEach(async () => {
    body = payload(1, 1);
    const platform = createBasicPlatform();
    platform.requests.fetch = jest.fn(() =>
      Promise.resolve({ status: 200, headers: new Headers(), text: async () => body }),
    ) as any;
    const source = new TestOverrideSource({ flags: [overriddenFlagMatching('segment1')] });
    queue = new AsyncQueue<string>();
    client = makeFDv2Client(
      platform,
      {
        dataSystem: {
          overrides: source,
          // The poll interval is in seconds; the test waits for the second poll.
          dataSource: {
            dataSourceOptionsType: 'custom',
            initializers: [],
            synchronizers: [{ type: 'polling', pollInterval: 1 }],
          },
        },
      },
      makeCallbacks((key) => queue.add(key), true),
    );
    await client.waitForInitialization({ timeout: 10 });
  });

  afterEach(() => {
    client.close();
  });

  // Takes every notification that has arrived, waiting briefly for stragglers, so that a later
  // assertion sees only notifications caused by what the test did next.
  async function drain(): Promise<string[]> {
    const keys: string[] = [];
    for (;;) {
      while (!queue.isEmpty()) {
        // eslint-disable-next-line no-await-in-loop
        keys.push(await queue.take());
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(100);
      if (queue.isEmpty()) {
        return keys;
      }
    }
  }

  it('notifies the overridden flag when the segment changes on the LaunchDarkly side', async () => {
    // Startup notifies the override (from the override source) and the LaunchDarkly flag, and the
    // segment in the initial data set reaches the override as well.
    const initial = await drain();
    expect(initial).toContain('ld-flag');
    expect(initial).toContain('overridden');
    expect(await client.boolVariation('overridden', user, false)).toBe(true);

    // The next poll delivers a new data set in which only the segment changed. The LaunchDarkly
    // flag is unchanged, so the override is the only flag notified.
    body = payload(2, 2);
    expect(await queue.take()).toEqual('overridden');
    await sleep(100);
    expect(queue.isEmpty()).toBeTruthy();
  });
});
