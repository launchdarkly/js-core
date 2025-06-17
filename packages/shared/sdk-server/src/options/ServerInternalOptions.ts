import { internal, LDPluginEnvironmentMetadata } from '@launchdarkly/js-sdk-common';

import { Hook } from '../integrations';

export interface ServerInternalOptions extends internal.LDInternalOptions {
  getImplementationHooks?: (environmentMetadata: LDPluginEnvironmentMetadata) => Hook[];
}
