import { Crypto } from '../../api';
import LDEventSummarizer, { SummarizedFlagsEvent } from '../../api/subsystem/LDEventSummarizer';
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
  private _tasks: Promise<void>[] = [];

  summarizeEvent(event: InputEvent) {
    // This will execute asynchronously, which means that a flush could happen before the event
    // is summarized. When that happens, then the event will just be in the next batch of summaries.
    this._tasks.push((async () => {
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
    })());
  }

  async getSummaries(): Promise<SummarizedFlagsEvent[]> {
    await Promise.all(this._tasks);
    const tmpTasks = this._tasks;
    this._tasks = [];
    return Object.values(this._summarizers).map((summarizer) => summarizer.getSummary());
  }

  clearSummary(): void {
    this._summarizers = {};
  }
}
