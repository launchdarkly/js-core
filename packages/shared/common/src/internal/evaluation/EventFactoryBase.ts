import { LDEvaluationReason, LDFlagValue } from '../../api';
import Context from '../../Context';
import { InputCustomEvent, InputEvalEvent, InputIdentifyEvent } from '../events';

export type EvalEventArgs = {
  addExperimentData?: boolean;
  context: Context;
  debugEventsUntilDate?: number;
  defaultVal: any;
  excludeFromSummaries?: boolean;
  flagKey: string;
  prereqOfFlagKey?: string;
  reason?: LDEvaluationReason;
  samplingRatio?: number;
  trackEvents: boolean;
  value: LDFlagValue;
  variation?: number;
  version: number;
};

export default class EventFactoryBase {
  constructor(private readonly _withReasons: boolean) {}

  evalEvent(e: EvalEventArgs): InputEvalEvent {
    return new InputEvalEvent(
      this._withReasons,
      e.context,
      e.flagKey,
      e.value,
      e.defaultVal,
      e.version,
      // Exclude null as a possibility.
      e.variation ?? undefined,
      e.trackEvents || e.addExperimentData,
      e.prereqOfFlagKey,
      this._withReasons || e.addExperimentData ? e.reason : undefined,
      e.debugEventsUntilDate,
      e.excludeFromSummaries,
      e.samplingRatio,
    );
  }

  unknownFlagEvent(key: string, defVal: LDFlagValue, context: Context) {
    return new InputEvalEvent(
      this._withReasons,
      context,
      key,
      defVal,
      defVal,
      // This isn't ideal, but the purpose of the factory is to at least
      // handle this situation.
      undefined, // version
      undefined, // variation index
      undefined, // track events
      undefined, // prereqOf
      undefined, // reason
      undefined, // debugEventsUntilDate
      undefined, // exclude from summaries
      undefined, // sampling ratio
    );
  }

  /* eslint-disable-next-line class-methods-use-this */
  identifyEvent(context: Context) {
    // Currently sampling for identify events is always 1.
    return new InputIdentifyEvent(context, 1);
  }

  /* eslint-disable-next-line class-methods-use-this */
  customEvent(
    key: string,
    context: Context,
    data?: any,
    metricValue?: number,
    samplingRatio: number = 1,
  ) {
    return new InputCustomEvent(
      context,
      key,
      data ?? undefined,
      metricValue ?? undefined,
      samplingRatio,
    );
  }
}
