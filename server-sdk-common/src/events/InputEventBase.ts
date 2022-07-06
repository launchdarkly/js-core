import { Context } from '@launchdarkly/js-sdk-common';

/**
 * @internal
 */
export default class InputEventBase {
  constructor(
    public readonly kind: string,
    public readonly creationDate: number,
    public readonly context: Context
  ) {}
}