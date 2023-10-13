import { Context, internal, LDEvaluationDetail } from '@launchdarkly/js-sdk-common';

import { Flag } from '../evaluation/data/Flag';
import isExperiment from './isExperiment';

/**
 * @internal
 */
export default class EventFactory extends internal.EventFactoryBase {
  evalEventServer(
    flag: Flag,
    context: Context,
    detail: LDEvaluationDetail,
    defaultVal: any,
    prereqOfFlag?: Flag,
  ): internal.InputEvalEvent {
    const addExperimentData = isExperiment(flag, detail.reason);
    return super.evalEvent({
      addExperimentData,
      context,
      debugEventsUntilDate: flag.debugEventsUntilDate,
      defaultVal,
      excludeFromSummaries: flag.excludeFromSummaries,
      flagKey: flag.key,
      prereqOfFlagKey: prereqOfFlag?.key,
      reason: detail.reason,
      samplingRatio: flag.samplingRatio,
      trackEvents: flag.trackEvents || addExperimentData,
      value: detail.value,
      variation: detail.variationIndex ?? undefined,
      version: flag.version,
    });
  }
}
