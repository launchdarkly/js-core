import { Context, LDEvaluationDetail, LDEvaluationReason } from '@launchdarkly/js-sdk-common';
import { Flag } from '../evaluation/data/Flag';
import isExperiment from './isExperiment';

/**
 * @internal
 */
export default class InputEvalEvent {
  public readonly kind = 'feature';

  public readonly creationDate: number;

  public readonly context: Context;

  public readonly default: any;

  public readonly trackEvents?: boolean;

  public readonly debugEventsUntilDate?: number;

  public readonly prereqOf?: string;

  public readonly reason?: LDEvaluationReason;

  public readonly value: any;

  public readonly variation?: number;

  public readonly version?: number;

  constructor(
    withReasons: boolean,
    context: Context,
    public readonly key: string,
    defValue: any, // default is a reserved keyword in this context.
    detail: LDEvaluationDetail,
    addExperimentData: boolean,
    public readonly flag?: Flag,
    prereqOf?: Flag,
  ) {
    this.creationDate = Date.now();
    this.context = context;
    this.default = defValue;
    this.variation = detail.variationIndex ?? undefined;
    this.value = detail.value;

    if (flag) {
      this.version = flag.version;

      if (addExperimentData || flag.trackEvents) {
        this.trackEvents = true;
      }

      if (flag.debugEventsUntilDate) {
        this.debugEventsUntilDate = flag.debugEventsUntilDate;
      }

      if (prereqOf) {
        this.prereqOf = prereqOf.key;
      }

      if (addExperimentData || withReasons) {
        this.reason = detail.reason;
      }
    }
  }
}
