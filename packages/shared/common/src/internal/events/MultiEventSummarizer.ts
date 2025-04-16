import { Crypto } from '../../api';
import { SummarizedFlagsEvent } from './LDEventSummarizer';
import ContextFilter from '../../ContextFilter';
import EventSummarizer from './EventSummarizer';
import { isFeature } from './guards';
import InputEvent from './InputEvent';

export default class LDMultiEventSummarizer implements LDMultiEventSummarizer {
  constructor(
    private readonly _crypto: Crypto,
    private readonly _contextFilter: ContextFilter,
  ) {}
  private _summarizers: Record<string, EventSummarizer> = {};

  summarizeEvent(event: InputEvent) {
    // This will execute asynchronously, which means that a flush could happen before the event
    // is summarized. When that happens, then the event will just be in the next batch of summaries.
    (async () => {
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
  }

  getSummaries(): SummarizedFlagsEvent[] {
    const summarizersToFlush = this._summarizers;
    this._summarizers = {};
    return Object.values(summarizersToFlush).map((summarizer) => summarizer.getSummary());
  }
}
