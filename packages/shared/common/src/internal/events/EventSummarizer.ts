import { isFeature } from './guards';
import InputEvalEvent from './InputEvalEvent';
import InputEvent from './InputEvent';
import SummaryCounter from './SummaryCounter';

function counterKey(event: InputEvalEvent) {
  return `${event.key}:${
    event.variation !== null && event.variation !== undefined ? event.variation : ''
  }:${event.version !== null && event.version !== undefined ? event.version : ''}`;
}

/**
 * @internal
 */
export interface FlagCounter {
  value: any;
  count: number;
  variation?: number;
  version?: number;
  unknown?: boolean;
}

/**
 * @internal
 */
export interface FlagSummary {
  default: any;
  counters: FlagCounter[];
  contextKinds: string[];
}

/**
 * @internal
 */
export interface SummarizedFlagsEvent {
  startDate: number;
  endDate: number;
  features: Record<string, FlagSummary>;
  kind: 'summary';
}

/**
 * @internal
 */
export default class EventSummarizer {
  private _startDate = 0;

  private _endDate = 0;

  private _counters: Record<string, SummaryCounter> = {};

  private _contextKinds: Record<string, Set<string>> = {};

  summarizeEvent(event: InputEvent) {
    if (isFeature(event) && !event.excludeFromSummaries) {
      const countKey = counterKey(event);
      const counter = this._counters[countKey];
      let kinds = this._contextKinds[event.key];
      if (!kinds) {
        kinds = new Set();
        this._contextKinds[event.key] = kinds;
      }
      event.context.kinds.forEach((kind) => kinds.add(kind));

      if (counter) {
        counter.increment();
      } else {
        this._counters[countKey] = new SummaryCounter(
          1,
          event.key,
          event.value,
          event.default,
          event.version,
          event.variation,
        );
      }

      if (this._startDate === 0 || event.creationDate < this._startDate) {
        this._startDate = event.creationDate;
      }
      if (event.creationDate > this._endDate) {
        this._endDate = event.creationDate;
      }
    }
  }

  getSummary(): SummarizedFlagsEvent {
    const features = Object.values(this._counters).reduce(
      (acc: Record<string, FlagSummary>, counter) => {
        let flagSummary = acc[counter.key];
        if (!flagSummary) {
          flagSummary = {
            default: counter.default,
            counters: [],
            contextKinds: [...this._contextKinds[counter.key]],
          };
          acc[counter.key] = flagSummary;
        }

        const counterOut: FlagCounter = {
          value: counter.value,
          count: counter.count,
        };
        if (counter.variation !== undefined && counter.variation !== null) {
          counterOut.variation = counter.variation;
        }
        if (counter.version !== undefined && counter.version !== null) {
          counterOut.version = counter.version;
        } else {
          counterOut.unknown = true;
        }
        flagSummary.counters.push(counterOut);

        return acc;
      },
      {},
    );

    return {
      startDate: this._startDate,
      endDate: this._endDate,
      features,
      kind: 'summary',
    };
  }

  clearSummary() {
    this._startDate = 0;
    this._endDate = 0;
    this._counters = {};
    this._contextKinds = {};
  }
}
