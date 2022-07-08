import { Context } from '@launchdarkly/js-sdk-common';
import { LDEvaluationDetail } from '../api';
import { Flag } from '../evaluation/data/Flag';
import InputCustomEvent from './InputCustomEvent';
import InputEvalEvent from './InputEvalEvent';
import InputIdentifyEvent from './InputIdentifyEvent';

/**
 * @internal
 */
export default class EventFactory {
  constructor(private readonly withReasons: boolean) { }

  evalEvent(
    flag: Flag,
    context: Context,
    detail: LDEvaluationDetail,
    defaultVal: any,
    prereqOfFlag?: Flag,
  ): InputEvalEvent {
    return new InputEvalEvent(
      this.withReasons,
      context,
      flag.key,
      defaultVal,
      detail,
      flag,
      prereqOfFlag,
    );
  }

  unknownFlagEvent(key: string, context: Context, detail: LDEvaluationDetail) {
    return new InputEvalEvent(
      this.withReasons,
      context,
      key,
      detail.value,
      detail,
    );
  }

  /* eslint-disable-next-line class-methods-use-this */
  identifyEvent(context: Context) {
    return new InputIdentifyEvent(context);
  }

  /* eslint-disable-next-line class-methods-use-this */
  customEvent(key: string, context: Context, data?: any, metricValue?: number) {
    return new InputCustomEvent(context, key, data || undefined, metricValue || undefined);
  }
}
