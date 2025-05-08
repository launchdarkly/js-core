import { Hook, LDClient, LDPluginBase } from '@launchdarkly/js-client-sdk-common';

/**
 * Interface for plugins to the LaunchDarkly SDK.
 */
export interface LDPlugin extends LDPluginBase<LDClient, Hook> {}
