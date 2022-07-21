import { Context } from '@launchdarkly/js-sdk-common';

/**
 * @internal
 */
export default class InputIdentifyEvent {
  public readonly kind = 'identify';

  public readonly creationDate: number;

  public readonly context: Context;

  constructor(context: Context) {
    this.creationDate = Date.now();
    this.context = context;
  }
}
