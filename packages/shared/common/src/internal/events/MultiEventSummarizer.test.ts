import { setupAsyncCrypto, setupCrypto } from '../../../__tests__/setupCrypto';
import Context from '../../Context';
import ContextFilter from '../../ContextFilter';
import InputEvalEvent from './InputEvalEvent';
import InputIdentifyEvent from './InputIdentifyEvent';
import MultiEventSummarizer from './MultiEventSummarizer';

// Test with both sync and async crypto implementations
describe.each([
  ['sync', setupCrypto()],
  ['async', setupAsyncCrypto()],
])('with mocked crypto and hasher/%s', (_name, crypto) => {
  let summarizer: MultiEventSummarizer;

  beforeEach(() => {
    const contextFilter = new ContextFilter(false, []);
    summarizer = new MultiEventSummarizer(crypto, contextFilter);
  });

  test('creates new summarizer for new context hash', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event = new InputEvalEvent(true, context, 'flag-key', 'value', 'default', 1, 0, true);

    summarizer.summarizeEvent(event);

    const summaries = await summarizer.getSummaries();
    expect(summaries).toHaveLength(1);
  });

  test('uses existing summarizer for same context hash', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event1 = new InputEvalEvent(true, context, 'flag-key', 'value1', 'default', 1, 0, true);
    const event2 = new InputEvalEvent(true, context, 'flag-key', 'value2', 'default', 1, 0, true);

    summarizer.summarizeEvent(event1);
    summarizer.summarizeEvent(event2);

    const summaries = await summarizer.getSummaries();
    expect(summaries).toHaveLength(1);
  });

  test('ignores non-feature events', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event = new InputIdentifyEvent(context);

    summarizer.summarizeEvent(event);

    const summaries = await summarizer.getSummaries();
    expect(summaries).toHaveLength(0);
  });

  test('handles multiple different contexts', async () => {
    const context1 = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const context2 = Context.fromLDContext({ kind: 'user', key: 'user2' });
    const event1 = new InputEvalEvent(true, context1, 'flag-key', 'value1', 'default', 1, 0, true);
    const event2 = new InputEvalEvent(true, context2, 'flag-key', 'value2', 'default', 1, 0, true);

    summarizer.summarizeEvent(event1);
    summarizer.summarizeEvent(event2);

    const summaries = await summarizer.getSummaries();
    expect(summaries).toHaveLength(2);
  });

  test('automatically clears summaries when summarized', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user1' });
    const event = new InputEvalEvent(true, context, 'flag-key', 'value', 'default', 1, 0, true);

    summarizer.summarizeEvent(event);

    const summariesA = await summarizer.getSummaries();
    const summariesB = await summarizer.getSummaries();
    expect(summariesA).toHaveLength(1);
    expect(summariesB).toHaveLength(0);
  });
});
