import { Context } from '@launchdarkly/js-sdk-common';
import InputEventBase from './InputEventBase';

/**
 * @internal
 */
export default class InputIdentifyEvent extends InputEventBase {
  constructor(context: Context) {
    super('identify', Date.now(), context);
  }
}
