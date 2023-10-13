import { Context, internal, LDEvaluationReason, LDFlagValue } from '@launchdarkly/js-sdk-common';

import { RawFlag } from '../evaluation/fetchFlags';

/**
 * @internal
 */
export default class EventFactory extends internal.EventFactoryBase {
  evalEventClient(
    flagKey: string,
    value: LDFlagValue,
    defaultVal: any,
    flag: RawFlag,
    context: Context,
    reason?: LDEvaluationReason,
  ): internal.InputEvalEvent {
    const { trackEvents, debugEventsUntilDate, version, variation } = flag;
    const addExperimentData = flag.trackReason || !!reason?.inExperiment;

    return super.evalEvent({
      addExperimentData,
      context,
      debugEventsUntilDate,
      defaultVal,
      flagKey,
      reason,
      trackEvents,
      value,
      variation,
      version,
    });
  }
}
