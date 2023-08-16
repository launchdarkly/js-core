import { Context, internal, LDEvaluationDetail } from '@launchdarkly/js-sdk-common';
import { LDEventOverrides } from '@launchdarkly/js-sdk-common/dist/internal';

import { Flag } from '../evaluation/data/Flag';
import isExperiment from './isExperiment';

/**
 * @internal
 */
export default class EventFactory {
  constructor(
    private readonly withReasons: boolean,
    private readonly eventConfig: LDEventOverrides = {
      samplingRatio: () => 1,
      indexEventSamplingRatio: () => 1,
    },
  ) {}

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
      flag.excludeFromSummaries,
      flag.samplingRatio,
    );
  }

  unknownFlagEvent(key: string, context: Context, detail: LDEvaluationDetail) {
    return new internal.InputEvalEvent(this.withReasons, context, key, detail.value, detail);
  }

  /* eslint-disable-next-line class-methods-use-this */
  identifyEvent(context: Context) {
    // Currently sampling for identify events is always 1.
    return new internal.InputIdentifyEvent(context, 1);
  }

  /* eslint-disable-next-line class-methods-use-this */
  customEvent(key: string, context: Context, data?: any, metricValue?: number, 
    samplingRatio: number = 1, indexSamplingRatio: number = 1) {
    return new internal.InputCustomEvent(
      context,
      key,
      data ?? undefined,
      metricValue ?? undefined,
      this.eventConfig.samplingRatio(key),
      samplingRatio,
      indexSamplingRatio
    );
  }
}
