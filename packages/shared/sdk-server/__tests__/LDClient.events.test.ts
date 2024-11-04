import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { Context, internal } from '@launchdarkly/js-sdk-common';

import { LDClientImpl } from '../src';
import TestData from '../src/integrations/test_data/TestData';
import { createBasicPlatform } from './createBasicPlatform';
import TestLogger, { LogLevel } from './Logger';
import makeCallbacks from './makeCallbacks';

const defaultUser = { key: 'user' };
const anonymousUser = { key: 'anon-user', anonymous: true };

describe('given a client with mock event processor', () => {
  let client: LDClientImpl;
  let events: AsyncQueue<internal.InputEvent>;
  let td: TestData;
  let logger: TestLogger;

  beforeEach(async () => {
    logger = new TestLogger();
    events = new AsyncQueue<internal.InputEvent>();
    jest
      .spyOn(internal.EventProcessor.prototype, 'sendEvent')
      .mockImplementation((evt) => events.add(evt));
    jest
      .spyOn(internal.EventProcessor.prototype, 'flush')
      .mockImplementation(() => Promise.resolve());

    td = new TestData();
    client = new LDClientImpl(
      'sdk-key-events',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        logger,
      },
      makeCallbacks(false),
    );
    await client.waitForInitialization({ timeout: 10 });
  });

  afterEach(() => {
    client.close();
  });

  it('generates event for existing feature', async () => {
    td.update(td.flag('flagkey').on(true).variations('a', 'b').fallthroughVariation(1));

    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 1,
      value: 'b',
      default: 'c',
    });
  });

  it('generates event for existing feature when user is anonymous', async () => {
    td.update(td.flag('flagkey').on(true).variations('a', 'b').fallthroughVariation(1));
    await client.variation('flagkey', anonymousUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(anonymousUser),
      variation: 1,
      value: 'b',
      default: 'c',
    });
  });

  it('generates event for existing feature with reason', async () => {
    td.update(td.flag('flagkey').on(true).variations('a', 'b').fallthroughVariation(1));
    await client.variationDetail('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 1,
      value: 'b',
      default: 'c',
      reason: { kind: 'FALLTHROUGH' },
    });
  });

  it('forces tracking when a matched rule has trackEvents set', async () => {
    td.usePreconfiguredFlag({
      // TestData doesn't normally set trackEvents
      key: 'flagkey',
      version: 1,
      on: true,
      targets: [],
      rules: [
        {
          clauses: [{ attribute: 'key', op: 'in', values: [defaultUser.key] }],
          variation: 0,
          id: 'rule-id',
          trackEvents: true,
        },
      ],
      fallthrough: { variation: 1 },
      variations: ['a', 'b'],
    });
    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      creationDate: e.creationDate,
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 0,
      value: 'a',
      default: 'c',
      trackEvents: true,
      reason: { kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'rule-id' },
    });
  });

  it('does not force tracking when a matched rule does not have trackEvents set', async () => {
    td.usePreconfiguredFlag({
      key: 'flagkey',
      version: 1,
      on: true,
      targets: [],
      rules: [
        {
          clauses: [{ attribute: 'key', op: 'in', values: [defaultUser.key] }],
          variation: 0,
          id: 'rule-id',
        },
      ],
      fallthrough: { variation: 1 },
      variations: ['a', 'b'],
    });
    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      creationDate: e.creationDate,
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 0,
      value: 'a',
      default: 'c',
    });
  });

  it('forces tracking for fallthrough result when trackEventsFallthrough is set', async () => {
    td.usePreconfiguredFlag({
      key: 'flagkey',
      version: 1,
      on: true,
      targets: [],
      rules: [],
      fallthrough: { variation: 1 },
      variations: ['a', 'b'],
      trackEventsFallthrough: true,
    });
    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      creationDate: e.creationDate,
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 1,
      value: 'b',
      default: 'c',
      trackEvents: true,
      reason: { kind: 'FALLTHROUGH' },
    });
  });

  it('forces tracking when an evaluation is in the tracked portion of an experiment rollout', async () => {
    td.usePreconfiguredFlag({
      key: 'flagkey',
      version: 1,
      on: true,
      targets: [],
      rules: [],
      fallthrough: {
        rollout: {
          kind: 'experiment',
          variations: [
            {
              weight: 100000,
              variation: 1,
            },
          ],
        },
      },
      variations: ['a', 'b'],
    });
    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      creationDate: e.creationDate,
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 1,
      value: 'b',
      default: 'c',
      trackEvents: true,
      reason: { kind: 'FALLTHROUGH', inExperiment: true },
    });
  });

  it('does not force tracking when an evaluation is in the untracked portion of an experiment rollout', async () => {
    td.usePreconfiguredFlag({
      key: 'flagkey',
      version: 1,
      on: true,
      targets: [],
      rules: [],
      fallthrough: {
        rollout: {
          kind: 'experiment',
          variations: [
            {
              weight: 100000,
              variation: 1,
              untracked: true,
            },
          ],
        },
      },
      variations: ['a', 'b'],
    });

    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      creationDate: e.creationDate,
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 1,
      value: 'b',
      default: 'c',
    });
  });

  it('does not force tracking for fallthrough result when trackEventsFallthrough is not set', async () => {
    td.update(td.flag('flagkey').on(true).variations('a', 'b').fallthroughVariation(1));
    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      creationDate: e.creationDate,
      key: 'flagkey',
      version: 1,
      context: Context.fromLDContext(defaultUser),
      variation: 1,
      value: 'b',
      default: 'c',
    });
  });

  it('generates event for unknown feature', async () => {
    await client.variation('flagkey', defaultUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      key: 'flagkey',
      context: Context.fromLDContext(defaultUser),
      value: 'c',
      default: 'c',
    });
  });

  it('generates event for unknown feature when user is anonymous', async () => {
    await client.variation('flagkey', anonymousUser, 'c');

    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'feature',
      key: 'flagkey',
      context: Context.fromLDContext(anonymousUser),
      value: 'c',
      default: 'c',
    });
  });

  it('produces track events with data', async () => {
    client.track('the-event', defaultUser, { the: 'data' }, undefined);
    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'custom',
      key: 'the-event',
      context: Context.fromLDContext(defaultUser),
      data: { the: 'data' },
    });
    expect(logger.getCount(LogLevel.Warn)).toBe(0);
  });

  it('produces track events with a metric value', async () => {
    client.track('the-event', defaultUser, undefined, 12);
    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'custom',
      key: 'the-event',
      context: Context.fromLDContext(defaultUser),
      metricValue: 12,
    });
    expect(logger.getCount(LogLevel.Warn)).toBe(0);
  });

  it('produces track events with a metric value and data', async () => {
    client.track('the-event', defaultUser, { the: 'data' }, 12);
    const e = await events.take();
    expect(e).toMatchObject({
      kind: 'custom',
      key: 'the-event',
      context: Context.fromLDContext(defaultUser),
      metricValue: 12,
      data: { the: 'data' },
    });
    expect(logger.getCount(LogLevel.Warn)).toBe(0);
  });

  it('produces a warning when the metric value is non-numeric', async () => {
    // @ts-ignore
    client.track('the-event', defaultUser, { the: 'data' }, '12');
    await events.take();
    expect(logger.getCount(LogLevel.Warn)).toBe(1);
    logger.expectMessages([
      {
        level: LogLevel.Warn,
        matches: /was called with a non-numeric/,
      },
    ]);
  });
});
