import { LDLogger } from '../../api';
import Context from '../../Context';
import ContextFilter from '../../ContextFilter';
import InputEvalEvent from './InputEvalEvent';
import InputIdentifyEvent from './InputIdentifyEvent';
import MultiEventSummarizer from './MultiEventSummarizer';

// Test with both sync and crypto implementations
describe('given a mock logger and an event summarizer instance', () => {
  let logger: LDLogger;
  let summarizer: MultiEventSummarizer;

  beforeEach(() => {
    const contextFilter = new ContextFilter(false, []);
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    summarizer = new MultiEventSummarizer(contextFilter, logger);
  });

  it('creates new summarizer for new context hash', () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event = new InputEvalEvent(true, context, 'flag-key', 'value', 'default', 1, 0, true);

    summarizer.summarizeEvent(event);

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(1);
  });

  it('uses existing summarizer for same context hash', () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event1 = new InputEvalEvent(true, context, 'flag-key', 'value1', 'default', 1, 0, true);
    const event2 = new InputEvalEvent(true, context, 'flag-key', 'value2', 'default', 1, 0, true);

    summarizer.summarizeEvent(event1);
    summarizer.summarizeEvent(event2);

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(1);
  });

  it('ignores non-feature events', () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event = new InputIdentifyEvent(context);

    summarizer.summarizeEvent(event);

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(0);
  });

  it('handles multiple different contexts', () => {
    const context1 = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const context2 = Context.fromLDContext({ kind: 'user', key: 'user2' });
    const event1 = new InputEvalEvent(true, context1, 'flag-key', 'value1', 'default', 1, 0, true);
    const event2 = new InputEvalEvent(true, context2, 'flag-key', 'value2', 'default', 1, 0, true);

    summarizer.summarizeEvent(event1);
    summarizer.summarizeEvent(event2);

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(2);
  });

  it('automatically clears summaries when summarized', () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event = new InputEvalEvent(true, context, 'flag-key', 'value', 'default', 1, 0, true);

    summarizer.summarizeEvent(event);

    const summariesA = summarizer.getSummaries();
    const summariesB = summarizer.getSummaries();
    expect(summariesA).toHaveLength(1);
    expect(summariesB).toHaveLength(0);
  });

  it('logs error when context cannot be hashed', () => {
    const a: any = {};
    const b: any = { a };
    a.b = b;

    const context = Context.fromLDContext({ kind: 'user', key: 'user1', cyclic: a });
    const event = new InputEvalEvent(true, context, 'flag-key', 'value', 'default', 1, 0, true);

    summarizer.summarizeEvent(event);
    summarizer.getSummaries();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Unable to serialize context, likely the context contains a cycle.',
    );
  });
});
