import { Context } from '@launchdarkly/js-sdk-common';
import EventFactory from '../../src/events/EventFactory';
import EventSummarizer from '../../src/events/EventSummarizer';

describe('given an event summarizer', () => {
  const summarizer = new EventSummarizer();
  const factory = new EventFactory(true);
  const context = Context.fromLDContext({ key: 'key' })!;

  beforeEach(() => {
    summarizer.clearSummary();
  });

  it('does nothing for an identify event.', () => {
    const beforeSummary = summarizer.getSummary();
    summarizer.summarizeEvent(factory.identifyEvent(context));
    const afterSummary = summarizer.getSummary();
    expect(beforeSummary).toEqual(afterSummary);
  });

  it('does nothing for a custom event.', () => {
    const beforeSummary = summarizer.getSummary();
    summarizer.summarizeEvent(factory.customEvent('custom', context, 'potato', 17));
    const afterSummary = summarizer.getSummary();
    expect(beforeSummary).toEqual(afterSummary);
  });

  it('sets start and end dates for feature events', () => {
    const event1 = {
      kind: 'feature', creationDate: 2000, key: 'key', context,
    };
    const event2 = {
      kind: 'feature', creationDate: 1000, key: 'key', context,
    };
    const event3 = {
      kind: 'feature', creationDate: 1500, key: 'key', context,
    };

    summarizer.summarizeEvent(event1 as any);
    summarizer.summarizeEvent(event2 as any);
    summarizer.summarizeEvent(event3 as any);
    const data = summarizer.getSummary();

    expect(data.startDate).toEqual(1000);
    expect(data.endDate).toEqual(2000);
  });

  it('increments counters for feature events', () => {
    Date.now = jest.fn(() => 1000);
    const event1 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context,
      variation: 1,
      value: 100,
      default: 111,
    };
    const event2 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context,
      variation: 2,
      value: 200,
      default: 111,
    };
    const event3 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key2',
      version: 22,
      context,
      variation: 1,
      value: 999,
      default: 222,
    };
    const event4 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context,
      variation: 1,
      value: 100,
      default: 111,
    };
    const event5 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'badkey',
      context,
      value: 333,
      default: 333,
    };
    const event6 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'zero-version',
      version: 0,
      context,
      variation: 1,
      value: 100,
      default: 444,
    };

    summarizer.summarizeEvent(event1 as any);
    summarizer.summarizeEvent(event2 as any);
    summarizer.summarizeEvent(event3 as any);
    summarizer.summarizeEvent(event4 as any);
    summarizer.summarizeEvent(event5 as any);
    summarizer.summarizeEvent(event6 as any);
    const summary = summarizer.getSummary();

    summary.features.key1.counters.sort((a, b) => a.value - b.value);
    const expectedFeatures = {
      'zero-version': {
        default: 444,
        counters: [
          {
            variation: 1, value: 100, version: 0, count: 1,
          },
        ],
        contextKinds: ['user'],
      },
      key1: {
        default: 111,
        counters: [
          {
            variation: 1, value: 100, version: 11, count: 2,
          },
          {
            variation: 2, value: 200, version: 11, count: 1,
          },
        ],
        contextKinds: ['user'],
      },
      key2: {
        default: 222,
        counters: [{
          variation: 1, value: 999, version: 22, count: 1,
        }],
        contextKinds: ['user'],
      },
      badkey: {
        default: 333,
        counters: [{ value: 333, unknown: true, count: 1 }],
        contextKinds: ['user'],
      },
    };
    expect(summary.features).toEqual(expectedFeatures);
  });

  it('distinguishes between zero and null/undefined in feature variation', () => {
    const event1 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context,
      variation: 0,
      value: 100,
      default: 111,
    };
    const event2 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context,
      variation: null,
      value: 111,
      default: 111,
    };
    const event3 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context,
      /* variation undefined */ value: 111,
      default: 111,
    };
    summarizer.summarizeEvent(event1 as any);
    summarizer.summarizeEvent(event2 as any);
    summarizer.summarizeEvent(event3 as any);
    const data = summarizer.getSummary();

    data.features.key1.counters.sort((a, b) => a.value - b.value);
    const expectedFeatures = {
      key1: {
        default: 111,
        counters: [
          {
            variation: 0, value: 100, version: 11, count: 1,
          },
          { value: 111, version: 11, count: 2 },
        ],
        contextKinds: ['user'],
      },
    };
    expect(data.features).toEqual(expectedFeatures);
  });

  it('includes keys from all kinds', () => {
    const event1 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context: Context.fromLDContext({ key: 'test' })!,
      variation: 1,
      value: 100,
      default: 111,
    };
    const event2 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context: Context.fromLDContext({ kind: 'org', key: 'test' })!,
      variation: 1,
      value: 100,
      default: 111,
    };
    const event3 = {
      kind: 'feature',
      creationDate: 1000,
      key: 'key1',
      version: 11,
      context: Context.fromLDContext({ kind: 'multi', bacon: { key: 'crispy' }, eggs: { key: 'scrambled' } })!,
      variation: 1,
      value: 100,
      default: 111,
    };
    summarizer.summarizeEvent(event1 as any);
    summarizer.summarizeEvent(event2 as any);
    summarizer.summarizeEvent(event3 as any);
    const data = summarizer.getSummary();

    const expectedFeatures = {
      key1: {
        default: 111,
        counters: [
          {
            variation: 1, value: 100, version: 11, count: 3,
          },
        ],
        contextKinds: ['user', 'org', 'bacon', 'eggs'],
      },
    };
    expect(data.features).toEqual(expectedFeatures);
  });
});
