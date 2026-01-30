import { Context, internal, LDEvaluationReason, LDFlagValue } from '@launchdarkly/js-sdk-common';

import { Flag } from '../types';

/**
 * EventFactory is used to create events for the client SDK.
 * @internal
 */
export default interface EventFactory {
  evalEventClient(
    flagKey: string,
    value: LDFlagValue,
    defaultVal: any,
    flag: Flag,
    context: Context,
    reason?: LDEvaluationReason,
  ): internal.InputEvalEvent;

  identifyEvent(context: Context): internal.InputIdentifyEvent;

  customEvent(
    key: string,
    context: Context,
    data?: any,
    metricValue?: number,
    samplingRatio?: number,
  ): internal.InputCustomEvent;

  unknownFlagEvent(key: string, defVal: LDFlagValue, context: Context): internal.InputEvalEvent;
}

/**
 * Creates an EventFactory instance.
 * @param withReasons Whether to include evaluation reasons in events.
 * @returns An EventFactory instance.
 */
export function createEventFactory(withReasons: boolean): EventFactory {
  const base = new internal.EventFactoryBase(withReasons);

  return {
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

      return base.evalEvent({
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
    },

    identifyEvent(context: Context): internal.InputIdentifyEvent {
      return base.identifyEvent(context);
    },

    customEvent(
      key: string,
      context: Context,
      data?: any,
      metricValue?: number,
      samplingRatio: number = 1,
    ): internal.InputCustomEvent {
      return base.customEvent(key, context, data, metricValue, samplingRatio);
    },

    unknownFlagEvent(key: string, defVal: LDFlagValue, context: Context): internal.InputEvalEvent {
      return base.unknownFlagEvent(key, defVal, context);
    },
  };
}
