import { LDLogger } from '../../api';
import ContextFilter from '../../ContextFilter';
import EventSummarizer from './EventSummarizer';
import { isFeature } from './guards';
import InputEvent from './InputEvent';
import { LDMultiEventSummarizer, SummarizedFlagsEvent } from './LDEventSummarizer';

export default class MultiEventSummarizer implements LDMultiEventSummarizer {
  constructor(
    private readonly _contextFilter: ContextFilter,
    private readonly _logger?: LDLogger,
  ) {}
  private _summarizers: Record<string, EventSummarizer> = {};

  summarizeEvent(event: InputEvent) {
    if (isFeature(event)) {
      const key = event.context.canonicalUnfilteredJson();
      if (!key) {
        if (event.context.valid) {
          // The context appeared valid, but it could not be hashed.
          // This is likely because of a cycle in the data.
          this._logger?.error('Unable to serialize context, likely the context contains a cycle.');
        }
        return;
      }

      let summarizer = this._summarizers[key];
      if (!summarizer) {
        this._summarizers[key] = new EventSummarizer(true, this._contextFilter);
        summarizer = this._summarizers[key];
      }

      summarizer.summarizeEvent(event);
    }
  }

  getSummaries(): SummarizedFlagsEvent[] {
    const summarizersToFlush = this._summarizers;
    this._summarizers = {};
    return Object.values(summarizersToFlush).map((summarizer) => summarizer.getSummary());
  }
}
