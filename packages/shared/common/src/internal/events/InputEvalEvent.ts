import { LDEvaluationReason, LDFlagValue } from '../../api/data';
import Context from '../../Context';

export default class InputEvalEvent {
  public readonly kind = 'feature';

  public readonly creationDate: number;

  public readonly default: any;

  public readonly trackEvents?: boolean;

  public readonly debugEventsUntilDate?: number;

  public readonly prereqOf?: string;

  public readonly reason?: LDEvaluationReason;

  public readonly value: any;

  public readonly variation?: number;

  public readonly version?: number;

  public readonly excludeFromSummaries?: boolean;

  /**
   * True when an override affected the evaluation, directly or transitively. The SDK sets it
   * from the evaluation result, not from the reason. A marked evaluation produces no individual
   * feature or debug event and is counted in a summary counter that carries the marker.
   */
  public readonly overrideAffected?: boolean;

  constructor(
    public readonly withReasons: boolean,
    public readonly context: Context,
    public readonly key: string,
    value: LDFlagValue,
    defValue: any, // default is a reserved keyword in this context.
    version?: number,
    variation?: number,
    trackEvents?: boolean,
    prereqOf?: string,
    reason?: LDEvaluationReason,
    debugEventsUntilDate?: number,
    excludeFromSummaries?: boolean,
    public readonly samplingRatio: number = 1,
    overrideAffected?: boolean,
  ) {
    this.creationDate = Date.now();
    this.value = value;
    this.default = defValue;

    if (version !== undefined) {
      this.version = version;
    }

    if (variation !== undefined) {
      this.variation = variation;
    }

    if (trackEvents !== undefined) {
      this.trackEvents = trackEvents;
    }

    if (prereqOf !== undefined) {
      this.prereqOf = prereqOf;
    }

    if (reason !== undefined) {
      this.reason = reason;
    }

    if (debugEventsUntilDate !== undefined) {
      this.debugEventsUntilDate = debugEventsUntilDate;
    }

    if (excludeFromSummaries !== undefined) {
      this.excludeFromSummaries = excludeFromSummaries;
    }

    if (overrideAffected !== undefined) {
      this.overrideAffected = overrideAffected;
    }
  }
}
