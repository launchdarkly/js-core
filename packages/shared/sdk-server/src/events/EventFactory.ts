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
    return super.evalEvent(
      flag.key,
      flag.version,
      flag.trackEvents || addExperimentData,
      context,
      detail,
      defaultVal,
      flag.debugEventsUntilDate,
      prereqOfFlag?.key,
      flag.excludeFromSummaries,
      flag.samplingRatio,
      addExperimentData,
    );
  }
}
