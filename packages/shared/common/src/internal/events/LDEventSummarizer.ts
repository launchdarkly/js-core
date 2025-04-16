import InputEvent from '../../internal/events/InputEvent';

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
  contextKinds?: string[];
}

/**
 * @internal
 */
export interface SummarizedFlagsEvent {
  startDate: number;
  endDate: number;
  features: Record<string, FlagSummary>;
  kind: 'summary';
  context?: any;
}

/**
 * Interface for summarizing feature flag evaluations bucketed by the context.
 */
export interface LDMultiEventSummarizer {
  /**
   * Processes an event for summarization if it is a feature flag event and not excluded from summaries.
   * @param event The event to potentially summarize
   */
  summarizeEvent(event: InputEvent): void;

  /**
   * Gets the current summary of processed events.
   * @returns A summary of all processed feature flag events
   */
  getSummaries(): SummarizedFlagsEvent[];
}

/**
 * Interface for summarizing feature flag evaluation events.
 */
export default interface LDEventSummarizer {
  /**
   * Processes an event for summarization if it is a feature flag event and not excluded from summaries.
   * @param event The event to potentially summarize
   */
  summarizeEvent(event: InputEvent): void;

  /**
   * Gets the current summary of processed events.
   * @returns A summary of all processed feature flag events
   */
  getSummary(): SummarizedFlagsEvent;
}
