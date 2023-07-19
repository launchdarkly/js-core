import { Context, LDEvaluationDetail, internal } from '@launchdarkly/js-sdk-common';
import { Flag } from '../evaluation/data/Flag';
import isExperiment from './isExperiment';

/**
 * @internal
 */
export default class EventFactory {
  constructor(private readonly withReasons: boolean) {}

  evalEvent(
    flag: Flag,
    context: Context,
    detail: LDEvaluationDetail,
    defaultVal: any,
    prereqOfFlag?: Flag,
  ): internal.InputEvalEvent {
    const addExperimentData = isExperiment(flag, detail.reason);
    return new internal.InputEvalEvent(
      this.withReasons,
      context,
      flag.key,
      defaultVal,
      detail,
      flag.version,
      // Exclude null as a possibility.
      detail.variationIndex ?? undefined,
      flag.trackEvents || addExperimentData,
      prereqOfFlag?.key,
      this.withReasons || addExperimentData ? detail.reason : undefined,
      flag.debugEventsUntilDate,
    );
  }

  unknownFlagEvent(key: string, context: Context, detail: LDEvaluationDetail) {
    return new internal.InputEvalEvent(this.withReasons, context, key, detail.value, detail);
  }

  /* eslint-disable-next-line class-methods-use-this */
  identifyEvent(context: Context) {
    return new internal.InputIdentifyEvent(context);
  }

  /* eslint-disable-next-line class-methods-use-this */
  customEvent(key: string, context: Context, data?: any, metricValue?: number) {
    return new internal.InputCustomEvent(context, key, data ?? undefined, metricValue ?? undefined);
  }
}
