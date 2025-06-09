import { integrations, LDPluginBase } from '@launchdarkly/js-server-sdk-common';

import { LDClient } from './LDClient';

/**
 * Interface for plugins to the LaunchDarkly SDK.
 *
 * @privateRemarks
 * The plugin interface must be in the leaf-sdk implementations to ensure it uses the correct LDClient intrface.
 * The LDClient in the shared server code doesn't match the LDClient interface of the individual SDKs.
 */
export interface LDPlugin extends LDPluginBase<LDClient, integrations.Hook> {}
