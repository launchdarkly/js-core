import { Context, internal, LDEvaluationDetail } from '@launchdarkly/js-sdk-common';

import { RawFlag } from '../evaluation/fetchFlags';

/**
 * @internal
 */
export default class EventFactory extends internal.EventFactoryBase {
  evalEventClient(
    flagKey: string,
    flag: RawFlag,
    context: Context,
    detail: LDEvaluationDetail,
    defaultVal: any,
  ): internal.InputEvalEvent {
    const { reason } = detail;
    const addExperimentData = flag.trackReason || reason?.inExperiment;
    return super.evalEvent(
      flagKey,
      flag.version,
      flag.trackEvents,
      context,
      detail,
      defaultVal,
      addExperimentData,
      flag.debugEventsUntilDate,
    );
  }
}
