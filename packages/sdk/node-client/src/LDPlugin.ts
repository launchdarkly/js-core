import { Hook, LDPluginBase } from '@launchdarkly/js-client-sdk-common';

import { LDClient } from './LDClient';

/**
 * Interface for plugins to the LaunchDarkly SDK.
 */
export interface LDPlugin extends LDPluginBase<LDClient, Hook> {}
