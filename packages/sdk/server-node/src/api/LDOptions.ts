import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

import { LDPlugin } from './LDPlugin';

/**
 * LaunchDarkly initialization options.
 *
 * @privateRemarks
 * The plugins implementation is SDK specific, so these options exist to extend the base options
 * with the node specific plugin configuration.
 */
export interface LDOptions extends LDOptionsCommon {
  /**
   * A list of plugins to be used with the SDK.
   *
   * Plugin support is currently experimental and subject to change.
   */
  plugins?: LDPlugin[];
}
