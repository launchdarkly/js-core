import { Context, internal, LDEvaluationReason, LDFlagValue } from '@launchdarkly/js-sdk-common';

import { Flag } from '../types';

/**
 * @internal
 */
export default class EventFactory extends internal.EventFactoryBase {
  evalEventClient(
    flagKey: string,
    value: LDFlagValue,
    defaultVal: any,
    flag: Flag,
    context: Context,
    reason?: LDEvaluationReason,
  ): internal.InputEvalEvent {
    const { trackEvents, debugEventsUntilDate, trackReason, flagVersion, version, variation } =
      flag;

    return super.evalEvent({
      addExperimentData: trackReason,
      context,
      debugEventsUntilDate,
      defaultVal,
      flagKey,
      reason,
      trackEvents: !!trackEvents,
      value,
      variation,
      version: flagVersion ?? version,
    });
  }
}
