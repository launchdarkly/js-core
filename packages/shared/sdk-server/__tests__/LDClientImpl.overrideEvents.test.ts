import LDClientImpl from '../src/LDClientImpl';
import {
  fdv2FullPayload,
  makeFDv2Client,
  makeFDv2Platform,
  singleValueFlag,
  summaryCountersFor,
} from './overrides/overridesTestSupport';
import TestOverrideSource from './overrides/TestOverrideSource';

const user = { key: 'user-key' };

function eventsOfKind(events: any[], kind: string): any[] {
  return events.filter((event) => event.kind === kind);
}

/**
 * A boolean flag that is on and serves variation 1 (true) by fallthrough, with optional
 * prerequisites that must each serve variation 1. Every flag requests individual events.
 */
function trackedBoolFlag(key: string, on: boolean, prereqKeys: string[] = []): any {
  return {
    key,
    version: 1,
    on,
    variations: [false, true],
    offVariation: 0,
    fallthrough: { variation: 1 },
    prerequisites: prereqKeys.map((prereqKey) => ({ key: prereqKey, variation: 1 })),
    trackEvents: true,
  };
}

describe('given an initialized client that sends events and an override source', () => {
  const debugUntil = Date.now() + 100000;
  // The overridden flag requests individual feature events and debug events. An ordinary flag
  // with this configuration produces both for each evaluation.
  const trackedOverride = {
    ...singleValueFlag('flag-tracked-override', 'override-value', 300),
    trackEvents: true,
    debugEventsUntilDate: debugUntil,
  };
  const normal = singleValueFlag('flag-normal', 'normal-value', 100);

  let capturedEvents: any[];
  let client: LDClientImpl;

  beforeEach(async () => {
    capturedEvents = [];
    const platform = makeFDv2Platform(fdv2FullPayload({ 'flag-normal': normal }), capturedEvents);
    const source = new TestOverrideSource({ flags: [trackedOverride] });
    client = makeFDv2Client(platform, { sendEvents: true, dataSystem: { overrides: source } });
    await client.waitForInitialization({ timeout: 5 });
  });

  afterEach(() => {
    client.close();
  });

  it('produces no individual event for an override-affected evaluation and marks its counter', async () => {
    // Two evaluations of the overridden flag accumulate into one marked counter.
    await client.variation('flag-tracked-override', user, 'default1');
    await client.variation('flag-tracked-override', user, 'default1');
    await client.variation('flag-normal', user, 'default2');

    await client.flush();

    expect(eventsOfKind(capturedEvents, 'index')).toHaveLength(1);
    expect(eventsOfKind(capturedEvents, 'feature')).toHaveLength(0);
    expect(eventsOfKind(capturedEvents, 'debug')).toHaveLength(0);

    const summary = eventsOfKind(capturedEvents, 'summary');
    expect(summary).toHaveLength(1);
    expect(summary[0].features['flag-tracked-override'].default).toEqual('default1');
    expect(summaryCountersFor(capturedEvents, 'flag-tracked-override')).toEqual([
      { value: 'override-value', variation: 0, version: 300, count: 2, overrideAffected: true },
    ]);
    expect(summary[0].features['flag-normal'].default).toEqual('default2');
    expect(summaryCountersFor(capturedEvents, 'flag-normal')).toEqual([
      { value: 'normal-value', variation: 0, version: 100, count: 1 },
    ]);
  });
});

describe('given a prerequisite tree with one overridden leaf', () => {
  // top-flag (LaunchDarkly) --> mid-flag (LaunchDarkly) --> leaf-flag (overridden)
  //                         --> plain-flag (LaunchDarkly)
  // The LaunchDarkly copy of leaf-flag is off, so the chain passes only through the override.
  let capturedEvents: any[];
  let client: LDClientImpl;

  beforeEach(async () => {
    capturedEvents = [];
    const platform = makeFDv2Platform(
      fdv2FullPayload({
        'top-flag': trackedBoolFlag('top-flag', true, ['mid-flag', 'plain-flag']),
        'mid-flag': trackedBoolFlag('mid-flag', true, ['leaf-flag']),
        'plain-flag': trackedBoolFlag('plain-flag', true),
        'leaf-flag': trackedBoolFlag('leaf-flag', false),
      }),
      capturedEvents,
    );
    const source = new TestOverrideSource({ flags: [trackedBoolFlag('leaf-flag', true)] });
    client = makeFDv2Client(platform, { sendEvents: true, dataSystem: { overrides: source } });
    await client.waitForInitialization({ timeout: 5 });
  });

  afterEach(() => {
    client.close();
  });

  it('marks each record by its own reads and keeps marked records out of the event stream', async () => {
    const detail = await client.boolVariationDetail('top-flag', user, false);
    expect(detail.value).toBe(true);
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });

    await client.flush();

    // Only the unaffected sibling produces an individual event, even though every flag in the
    // tree has event tracking on. Its record carries the prerequisite relationship.
    const featureEvents = eventsOfKind(capturedEvents, 'feature');
    expect(featureEvents.map((event) => event.key)).toEqual(['plain-flag']);
    expect(featureEvents[0].prereqOf).toEqual('top-flag');
    expect(featureEvents[0].reason).toEqual({ kind: 'FALLTHROUGH' });
    expect(eventsOfKind(capturedEvents, 'debug')).toHaveLength(0);

    // The top-level flag and the intermediate prerequisite came from LaunchDarkly. Their
    // records are marked because a definition read during their evaluation came from the
    // override store. The leaf is marked directly. The sibling read nothing from the store.
    ['top-flag', 'mid-flag', 'leaf-flag'].forEach((key) => {
      const counters = summaryCountersFor(capturedEvents, key);
      expect(counters).toHaveLength(1);
      expect(counters[0].overrideAffected).toBe(true);
      expect(counters[0].value).toBe(true);
    });
    const plainCounters = summaryCountersFor(capturedEvents, 'plain-flag');
    expect(plainCounters).toHaveLength(1);
    expect(plainCounters[0]).not.toHaveProperty('overrideAffected');
  });
});

describe('given an uninitialized client that sends events and an override source', () => {
  it('marks the counter of a wrong type result of an overridden flag', async () => {
    const capturedEvents: any[] = [];
    const source = new TestOverrideSource({
      flags: [singleValueFlag('overridden-flag', 'not-a-bool', 7)],
    });
    const client = makeFDv2Client(makeFDv2Platform(undefined, capturedEvents), {
      sendEvents: true,
      dataSystem: { overrides: source },
    });
    try {
      expect(await client.boolVariation('overridden-flag', user, false)).toBe(false);
      await client.flush();

      expect(eventsOfKind(capturedEvents, 'feature')).toHaveLength(0);
      expect(summaryCountersFor(capturedEvents, 'overridden-flag')).toEqual([
        { value: false, version: 7, count: 1, overrideAffected: true },
      ]);
    } finally {
      client.close();
    }
  });
});
