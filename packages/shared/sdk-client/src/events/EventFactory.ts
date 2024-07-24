import { Context, internal, LDEvaluationReason, LDFlagValue } from '@launchdarkly/js-sdk-common';

import { LDEvaluationResult } from '../types';

/**
 * @internal
 */
export default class EventFactory extends internal.EventFactoryBase {
  evalEventClient(
    flagKey: string,
    value: LDFlagValue,
    defaultVal: any,
    flag: LDEvaluationResult,
    context: Context,
    reason?: LDEvaluationReason,
  ): internal.InputEvalEvent {
    const { trackEvents, debugEventsUntilDate, trackReason, version, variation } = flag;

    return super.evalEvent({
      addExperimentData: trackReason,
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
