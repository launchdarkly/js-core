import { LDEvaluationDetail } from '../../api';
import Context from '../../Context';
import { InputCustomEvent, InputEvalEvent, InputIdentifyEvent } from '../events';

export default class EventFactory {
  constructor(private readonly withReasons: boolean) {}

  // evalEvent(
  //   flag: Flag,
  //   context: Context,
  //   detail: LDEvaluationDetail,
  //   defaultVal: any,
  //   prereqOfFlag?: Flag,
  // ): InputEvalEvent {
  //   const addExperimentData = isExperiment(flag, detail.reason);
  //   return new InputEvalEvent(
  //     this.withReasons,
  //     context,
  //     flag.key,
  //     defaultVal,
  //     detail,
  //     flag.version,
  //     // Exclude null as a possibility.
  //     detail.variationIndex ?? undefined,
  //     flag.trackEvents || addExperimentData,
  //     prereqOfFlag?.key,
  //     this.withReasons || addExperimentData ? detail.reason : undefined,
  //     flag.debugEventsUntilDate,
  //     flag.excludeFromSummaries,
  //     flag.samplingRatio,
  //   );
  // }

  unknownFlagEvent(key: string, context: Context, detail: LDEvaluationDetail) {
    return new InputEvalEvent(
      this.withReasons,
      context,
      key,
      detail.value,
      detail,
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
