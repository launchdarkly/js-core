import InputEvalEvent from './InputEvalEvent';
import InputEventBase from './InputEventBase';
import SummaryCounter from './SummaryCounter';

function isFeature(u: InputEventBase): u is InputEvalEvent {
  return u.kind === 'feature';
}

function counterKey(event: InputEvalEvent) {
  return `${event.key
  }:${event.variation !== null && event.variation !== undefined ? event.variation : ''
  }:${event.version !== null && event.version !== undefined ? event.version : ''}`;
}

/**
 * @internal
 */
export interface FlagCounter {
  value: any,
  count: number,
  variation?: number,
  version?: number,
  unknown?: boolean,
}

/**
 * @internal
 */
export interface FlagSummary {
  default: any,
  counters: FlagCounter[],
  contextKinds: string[]
}

/**
 * @internal
 */
export interface SummarizedFlags {
  startDate: number,
  endDate: number,
  features: Record<string, FlagSummary>
}

/**
 * @internal
 */
export default class EventSummarizer {
  private startDate = 0;

  private endDate = 0;

  private counters: Record<string, SummaryCounter> = {};

  private contextKinds: Record<string, Set<string>> = {};

  summarizeEvent(event: InputEventBase) {
    if (isFeature(event)) {
      const countKey = counterKey(event);
      const counter = this.counters[countKey];
      let kinds = this.contextKinds[event.key];
      if (!kinds) {
        kinds = new Set();
        this.contextKinds[event.key] = kinds;
      }
      event.context.kinds.forEach((kind) => kinds.add(kind));

      if (counter) {
        counter.increment();
      } else {
        this.counters[countKey] = new SummaryCounter(
          1,
          event.key,
          event.value,
          event.default,
          event.version,
          event.variation,
        );
      }

      if (this.startDate === 0 || event.creationDate < this.startDate) {
        this.startDate = event.creationDate;
      }
      if (event.creationDate > this.endDate) {
        this.endDate = event.creationDate;
      }
    }
  }

  getSummary(): SummarizedFlags {
    const features = Object.values(this.counters)
      .reduce((acc: Record<string, FlagSummary>, counter) => {
        let flagSummary = acc[counter.key];
        if (!flagSummary) {
          flagSummary = {
            default: counter.default,
            counters: [],
            contextKinds: [...this.contextKinds[counter.key]],
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
      }, {});

    return {
      startDate: this.startDate,
      endDate: this.endDate,
      features,
    };
  }

  clearSummary() {
    this.startDate = 0;
    this.endDate = 0;
    this.counters = {};
    this.contextKinds = {};
  }
}
