import { Crypto } from '../../api';
import ContextFilter from '../../ContextFilter';
import EventSummarizer from './EventSummarizer';
import { isFeature } from './guards';
import InputEvent from './InputEvent';
import { LDMultiEventSummarizer, SummarizedFlagsEvent } from './LDEventSummarizer';

export default class MultiEventSummarizer implements LDMultiEventSummarizer {
  constructor(
    private readonly _crypto: Crypto,
    private readonly _contextFilter: ContextFilter,
  ) {}
  private _summarizers: Record<string, EventSummarizer> = {};
  private _pendingPromises: Promise<void>[] = [];

  summarizeEvent(event: InputEvent) {
    // The event is summarized asynchronously, but the promise is created synchronously, this means that all events
    // which have been requested to be summarized will be in the next flush.
    const promise = (async () => {
      if (isFeature(event)) {
        const hash = await event.context.hash(this._crypto);
        if (!hash) {
          return;
        }
        // It is important that async operations do not happen between checking that the summarizer
        // exists and having it summarize the event.
        // If it did, then that event could be lost.
        let summarizer = this._summarizers[hash];
        if (!summarizer) {
          this._summarizers[hash] = new EventSummarizer(true, this._contextFilter);
          summarizer = this._summarizers[hash];
        }

        summarizer.summarizeEvent(event);
      }
    })();
    this._pendingPromises.push(promise);
    promise.finally(() => {
      const index = this._pendingPromises.indexOf(promise);
      if (index !== -1) {
        this._pendingPromises.splice(index, 1);
      }
    });
  }

  async getSummaries(): Promise<SummarizedFlagsEvent[]> {
    // Wait for any pending summarizations to complete
    // Additional tasks queued while waiting will not be waited for.
    await Promise.all([...this._pendingPromises]);

    // It is important not to put any async operations between caching the summarizers and clearing them.
    // If we did then summerizers added during the async operation would be lost.
    const summarizersToFlush = this._summarizers;
    this._summarizers = {};
    return Object.values(summarizersToFlush).map((summarizer) => summarizer.getSummary());
  }
}
