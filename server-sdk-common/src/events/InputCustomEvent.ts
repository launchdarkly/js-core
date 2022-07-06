import { Context } from '@launchdarkly/js-sdk-common';
import InputEventBase from './InputEventBase';

/**
 * @internal
 */
export default class InputCustomEvent extends InputEventBase {
  constructor(
    context: Context,
    public readonly key: string,
    public readonly data?: any,
    public readonly metricValue?: number,
  ) {
    super('custom', Date.now(), context);
  }
}