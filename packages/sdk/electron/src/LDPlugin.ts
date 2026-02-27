import type { Hook, LDPluginBase } from '@launchdarkly/node-client-sdk';

import type { LDClient } from './LDClient';

/**
 * Interface for plugins to the LaunchDarkly SDK.
 */
export interface LDPlugin extends LDPluginBase<LDClient, Hook> {}
