import { LDPluginBase } from '@launchdarkly/js-sdk-common';

import { LDDebugOverride } from '../flag-manager/FlagManager';

export interface LDPlugin<TClient, THook> extends LDPluginBase<TClient, THook> {
  /**
   * An optional function called if the plugin wants to register debug capabilities.
   * This method allows plugins to receive a debug override interface for
   * temporarily overriding flag values during development and testing.
   *
   * @experimental This interface is experimental and intended for use by LaunchDarkly tools at this time.
   * The API may change in future versions.
   *
   * @param debugOverride The debug override interface instance
   */
  registerDebug?(debugOverride: LDDebugOverride): void;
}
